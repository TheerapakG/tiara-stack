import { InteractionsRegistry } from "dfx/gateway";
import { ApplicationIntegrationType, InteractionContextType } from "discord-api-types/v10";
import { Ix } from "dfx/index";
import { Effect, Layer } from "effect";
import { CommandHelper, InteractionResponse } from "dfx-discord-utils/utils";
import { InteractionToken } from "dfx-discord-utils/utils";
import { discordApplicationLayer } from "../discord/application";
import { discordGatewayLayer } from "../discord/gateway";
import { SheetClusterClient, SheetClusterRequestContext } from "../services";
import { interactionDeadlineEpochMs } from "../utils/interactionDeadline";
import { runSheetClusterDispatch } from "../utils/sheetClusterDispatch";

const makeStatusCommand = Effect.gen(function* () {
  const sheetClusterClient = yield* SheetClusterClient;

  return yield* CommandHelper.makeCommand(
    (builder) =>
      builder
        .setName("status")
        .setDescription("Show service readiness status")
        .setIntegrationTypes(
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        )
        .setContexts(
          InteractionContextType.BotDM,
          InteractionContextType.Guild,
          InteractionContextType.PrivateChannel,
        ),
    Effect.fn("status")(function* () {
      const response = yield* InteractionResponse;
      yield* response.deferReply();

      yield* runSheetClusterDispatch(
        response,
        "the service status check",
        SheetClusterRequestContext.asInteractionUser(
          Effect.fn("status.dispatch")(function* () {
            const interactionToken = yield* InteractionToken;
            const interaction = yield* Ix.Interaction;
            return yield* sheetClusterClient.get().dispatch.serviceStatus({
              payload: {
                dispatchRequestId: `discord-interaction:${interaction.id}`,
                interactionToken: interactionToken.token,
                interactionDeadlineEpochMs: interactionDeadlineEpochMs(interaction.id),
              },
            });
          }),
        )(),
      );
    }),
  );
});

const makeGlobalStatusCommand = Effect.gen(function* () {
  const statusCommand = yield* makeStatusCommand;

  return CommandHelper.makeGlobalCommand(statusCommand.data, statusCommand.handler as never);
});

export const statusCommandLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const command = yield* makeGlobalStatusCommand;

    yield* registry.register(Ix.builder.add(command).catchAllCause(Effect.log));
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(discordGatewayLayer, discordApplicationLayer, SheetClusterClient.layer),
  ),
);
