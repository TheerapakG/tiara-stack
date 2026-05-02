import { InteractionsRegistry } from "dfx/gateway";
import { Discord, DiscordREST, Ix } from "dfx";
import { MessageFlags } from "discord-api-types/v10";
import { Deferred, Effect, Layer, Option } from "effect";
import type { DiscordRestService } from "dfx/DiscordREST";
import { DiscordApplication } from "dfx-discord-utils/discord";
import {
  Interaction,
  makeMessageComponentHelper,
  MessageComponentHelper,
} from "dfx-discord-utils/utils";
import { discordApplicationLayer } from "../../discord/application";
import { discordGatewayLayer } from "../../discord/gateway";
import { sdkClient, type VibecordButtonInteraction } from "../../sdk/index";

const makeAdapter = (
  helper: MessageComponentHelper,
  customId: string,
  rest: DiscordRestService,
  application: Discord.PrivateApplicationResponse,
) =>
  Effect.gen(function* () {
    const effects: Array<Effect.Effect<unknown, unknown, never>> = [];
    let initialResponseQueued = false;
    const interaction = yield* Ix.Interaction;
    const user = (yield* Interaction.user()) as { id: string };
    const message = (yield* Interaction.message().pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail(new Error("Interaction has no message")),
          onSome: Effect.succeed,
        }),
      ),
    )) as VibecordButtonInteraction["message"];

    const enqueue = (effect: Effect.Effect<unknown, unknown, never>) => {
      effects.push(effect);
      return Promise.resolve();
    };
    const enqueueInitialResponse = (effect: Effect.Effect<unknown, unknown, never>) => {
      if (initialResponseQueued) {
        return Promise.reject(new Error("Interaction initial response already queued"));
      }
      initialResponseQueued = true;
      return enqueue(effect);
    };

    return {
      adapter: {
        customId,
        userId: user.id,
        message,
        reply: (payload) =>
          enqueueInitialResponse(
            helper.reply({
              content: payload.content,
              flags: payload.flags ?? (payload.ephemeral ? MessageFlags.Ephemeral : undefined),
            }),
          ),
        update: (payload) =>
          enqueueInitialResponse(helper.update({ components: payload.components })),
        followUp: (payload) => {
          const payloadWithFlags = {
            content: payload.content,
            flags: payload.flags ?? (payload.ephemeral ? MessageFlags.Ephemeral : undefined),
          };
          if (!initialResponseQueued) {
            return enqueueInitialResponse(helper.reply(payloadWithFlags));
          }

          return enqueue(
            rest.executeWebhook(application.id, interaction.token, {
              payload: {
                content: payloadWithFlags.content,
                flags: payloadWithFlags.flags,
              },
            }),
          );
        },
      } satisfies VibecordButtonInteraction,
      flush: Effect.suspend(() => Effect.forEach(effects, (effect) => effect, { discard: true })),
    };
  });

const makeButtonLayer = (prefix: "p_" | "q_" | "qc_") =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const registry = yield* InteractionsRegistry;
      const rest = yield* DiscordREST;
      const application = yield* DiscordApplication;
      const component = Ix.messageComponent(
        Ix.idStartsWith(prefix),
        Effect.gen(function* () {
          const helper = yield* makeMessageComponentHelper(rest, application);
          const data = yield* Ix.MessageComponentData;
          const customId = data.custom_id;
          const { adapter, flush } = yield* makeAdapter(helper, customId, rest, application);
          const handled =
            prefix === "p_"
              ? yield* Effect.tryPromise(() => sdkClient.handlePermissionButton(adapter))
              : yield* Effect.tryPromise(() => sdkClient.handleQuestionButton(adapter));

          if (!handled) {
            yield* helper.reply({ content: "Unknown button.", flags: MessageFlags.Ephemeral });
          }

          yield* flush;
          const { files, payload } = yield* Deferred.await(helper.response);
          return {
            files,
            ...payload,
          };
        }),
      );
      yield* registry.register(Ix.builder.add(component).catchAllCause(Effect.log));
    }),
  ).pipe(Layer.provide(Layer.mergeAll(discordGatewayLayer, discordApplicationLayer)));

export const permissionButtonLayer = makeButtonLayer("p_");
export const questionButtonLayer = Layer.mergeAll(makeButtonLayer("q_"), makeButtonLayer("qc_"));
