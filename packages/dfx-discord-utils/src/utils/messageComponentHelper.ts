import { Discord, DiscordREST, Ix } from "dfx";
import { DiscordRestService } from "dfx/DiscordREST";
import type { MessageComponent as DfxMessageComponent } from "dfx/Interactions/definitions";
import type { DiscordMessageComponent } from "dfx/Interactions/context";
import { MessageFlags } from "discord-api-types/v10";
import { Deferred, Effect, FiberMap, pipe, Scope } from "effect";
import { DiscordApplication } from "../discord/gateway";
import { formatErrorResponse, makeDiscordErrorMessageResponse } from "./errorResponse";
import {
  ActionRowBuilder,
  ButtonBuilder,
  MessageActionRowComponentBuilder,
} from "./messageComponentBuilder";
import { DiscordInteraction } from "dfx/Interactions/context";
import { InteractionToken, provideInteractionToken } from "./interaction";

type AcknowledgementState = "none" | "replied" | "updated" | "deferred-reply" | "deferred-update";

export class MessageComponentHelper {
  private acknowledgementState: AcknowledgementState = "none";

  constructor(
    readonly rest: DiscordRestService,
    private readonly application: Discord.PrivateApplicationResponse,
    readonly response: Deferred.Deferred<{
      readonly files: ReadonlyArray<File>;
      readonly payload: Discord.CreateInteractionResponseRequest;
    }>,
  ) {}

  reply = Effect.fn("MessageComponentHelper.reply")(
    { self: this },
    function* (payload?: Discord.IncomingWebhookInteractionRequest) {
      this.acknowledgementState = "replied";
      return yield* Deferred.succeed(this.response, {
        files: [],
        payload: {
          type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: payload,
        },
      });
    },
  );

  replyWithFiles = Effect.fn("MessageComponentHelper.replyWithFiles")(
    { self: this },
    function* (files: ReadonlyArray<File>, response?: Discord.IncomingWebhookInteractionRequest) {
      this.acknowledgementState = "replied";
      return yield* Deferred.succeed(this.response, {
        files,
        payload: {
          type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: response,
        },
      });
    },
  );

  update = Effect.fn("MessageComponentHelper.update")(
    { self: this },
    function* (payload?: Discord.IncomingWebhookInteractionRequest) {
      this.acknowledgementState = "updated";
      return yield* Deferred.succeed(this.response, {
        files: [],
        payload: {
          type: Discord.InteractionCallbackTypes.UPDATE_MESSAGE,
          data: payload,
        },
      });
    },
  );

  updateWithFiles = Effect.fn("MessageComponentHelper.updateWithFiles")(
    { self: this },
    function* (files: ReadonlyArray<File>, payload?: Discord.IncomingWebhookInteractionRequest) {
      this.acknowledgementState = "updated";
      return yield* Deferred.succeed(this.response, {
        files,
        payload: {
          type: Discord.InteractionCallbackTypes.UPDATE_MESSAGE,
          data: payload,
        },
      });
    },
  );

  deferReply = Effect.fn("MessageComponentHelper.deferReply")(
    { self: this },
    function* (response?: Discord.IncomingWebhookInteractionRequest) {
      this.acknowledgementState = "deferred-reply";
      return yield* Deferred.succeed(this.response, {
        files: [],
        payload: {
          type: Discord.InteractionCallbackTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: response,
        },
      });
    },
  );

  deferUpdate = Effect.fn("MessageComponentHelper.deferUpdate")(
    { self: this },
    function* (response?: Discord.IncomingWebhookInteractionRequest) {
      this.acknowledgementState = "deferred-update";
      return yield* Deferred.succeed(this.response, {
        files: [],
        payload: {
          type: Discord.InteractionCallbackTypes.DEFERRED_UPDATE_MESSAGE,
          data: response,
        },
      });
    },
  );

  respondWithError = Effect.fn("MessageComponentHelper.respondWithError")(
    { self: this },
    function* (error: unknown) {
      const rendered = makeDiscordErrorMessageResponse(
        "Interaction failed",
        formatErrorResponse(error),
      );
      const payload: Discord.IncomingWebhookRequestPartial = {
        content: rendered.content,
        flags: MessageFlags.Ephemeral,
      };

      if (this.acknowledgementState === "deferred-reply") {
        return yield* rendered.files.length === 0
          ? this.editReply({ payload: { content: rendered.content } })
          : this.editReplyWithFiles(rendered.files, { payload: { content: rendered.content } });
      }

      if (this.acknowledgementState === "deferred-update") {
        yield* this.editReply({ payload: {} });
        return yield* this.followUp(payload, rendered.files);
      }

      if (this.acknowledgementState !== "none") {
        return yield* this.followUp(payload, rendered.files);
      }

      const sent = yield* rendered.files.length === 0
        ? this.reply(payload)
        : this.replyWithFiles(rendered.files, payload);
      if (!sent) {
        return yield* this.followUp(payload, rendered.files);
      }
    },
  );

  private followUp = Effect.fn("MessageComponentHelper.followUp")(
    { self: this },
    function* (payload: Discord.IncomingWebhookRequestPartial, files: ReadonlyArray<File>) {
      const interactionToken = yield* InteractionToken;
      const request = this.rest.executeWebhook(this.application.id, interactionToken.token, {
        params: { wait: true },
        payload,
      });

      return files.length === 0 ? yield* request : yield* this.rest.withFiles(files)(request);
    },
  );

  editReply = Effect.fn("MessageComponentHelper.editReply")(
    { self: this },
    function* (response: {
      readonly params?: Discord.UpdateOriginalWebhookMessageParams;
      readonly payload: Discord.IncomingWebhookUpdateRequestPartial;
    }) {
      const interactionToken = yield* InteractionToken;

      return yield* this.rest.updateOriginalWebhookMessage(
        this.application.id,
        interactionToken.token,
        response,
      );
    },
  );

  editReplyWithFiles = Effect.fn("MessageComponentHelper.editReplyWithFiles")(
    { self: this },
    function* (
      files: ReadonlyArray<File>,
      response: {
        readonly params?: Discord.UpdateOriginalWebhookMessageParams;
        readonly payload: Discord.IncomingWebhookUpdateRequestPartial;
      },
    ) {
      const interactionToken = yield* InteractionToken;

      return yield* this.rest.withFiles(files)(
        this.rest.updateOriginalWebhookMessage(
          this.application.id,
          interactionToken.token,
          response,
        ),
      );
    },
  );
}

export const makeMessageComponentHelper = Effect.fnUntraced(function* (
  rest: DiscordRestService,
  application: Discord.PrivateApplicationResponse,
) {
  const response = yield* Deferred.make<{
    readonly files: ReadonlyArray<File>;
    readonly payload: Discord.CreateInteractionResponseRequest;
  }>();
  return new MessageComponentHelper(rest, application, response);
});

export const makeForkedMessageComponentHandler = Effect.fnUntraced(function* <E = never, R = never>(
  handler: (messageComponentHelper: MessageComponentHelper) => Effect.Effect<unknown, E, R>,
) {
  const fiberMap = yield* FiberMap.make<Discord.Snowflake>();

  return Effect.fnUntraced(function* (helper: MessageComponentHelper) {
    const context = yield* Ix.Interaction;

    yield* pipe(handler(helper), provideInteractionToken, FiberMap.run(fiberMap, context.id));
  });
});

export const makeButtonData = <
  const A extends { type: typeof Discord.MessageComponentTypes.BUTTON; readonly custom_id: string },
>(
  data: (builder: ButtonBuilder) => ButtonBuilder<A>,
) => data(new ButtonBuilder());

export const makeMessageActionRowData = <
  const A extends {
    type: typeof Discord.MessageComponentTypes.ACTION_ROW;
    readonly components: ReadonlyArray<{ type: typeof Discord.MessageComponentTypes.BUTTON }>;
  },
>(
  data: (
    builder: ActionRowBuilder<MessageActionRowComponentBuilder>,
  ) => ActionRowBuilder<MessageActionRowComponentBuilder, A>,
) => data(new ActionRowBuilder());

type MessageComponentEnv<R> = Exclude<
  Exclude<R, InteractionToken>,
  DiscordInteraction | DiscordMessageComponent | Scope.Scope
>;

type BuiltMessageComponent<E, R> = {
  readonly data: { readonly custom_id: string };
  readonly handler: Effect.Effect<
    Discord.CreateInteractionResponseRequest,
    E,
    DiscordInteraction | Exclude<R, InteractionToken>
  >;
};

const makeButtonInternal = Effect.fnUntraced(function* <E = never, R = never>(
  data: { readonly custom_id: string },
  handler: (messageComponentHelper: MessageComponentHelper) => Effect.Effect<unknown, E, R>,
) {
  const rest = yield* DiscordREST;
  const application = yield* DiscordApplication;
  const forkedHandler = yield* makeForkedMessageComponentHandler(
    Effect.fnUntraced(function* (helper: MessageComponentHelper) {
      const shouldRunFallback = yield* handler(helper).pipe(
        Effect.as(true),
        Effect.catchCause((cause) =>
          Effect.logError(cause).pipe(
            Effect.andThen(helper.respondWithError(cause)),
            Effect.as(false),
          ),
        ),
      );

      if (!shouldRunFallback) {
        return;
      }

      yield* helper.reply({ content: "The button did not set a response." });
    }),
  );
  const builtMessageComponent: BuiltMessageComponent<E, R> = {
    data,
    handler: Effect.gen(function* () {
      const helper = yield* makeMessageComponentHelper(rest, application);
      yield* forkedHandler(helper);
      const { files, payload } = yield* Deferred.await(helper.response);
      return {
        files,
        ...payload,
      };
    }),
  };

  return builtMessageComponent;
});

export const makeButton = makeButtonInternal;

export const makeMessageComponent = <E = never, R = never>(
  data: { readonly custom_id: string },
  handler: Effect.Effect<Discord.CreateInteractionResponseRequest, E, R>,
): DfxMessageComponent<MessageComponentEnv<R>, E> =>
  Ix.messageComponent(Ix.id(data.custom_id), provideInteractionToken(handler));
