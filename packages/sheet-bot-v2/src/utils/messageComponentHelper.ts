import { Discord, DiscordREST, Ix } from "dfx";
import { DiscordRestService } from "dfx/DiscordREST";
import { Deferred, Effect, FiberMap, pipe } from "effect";
import { DiscordApplication } from "../discord/gateway";
import {
  ActionRowBuilder,
  ButtonBuilder,
  MessageActionRowComponentBuilder,
} from "./messageComponentBuilder";

export class MessageComponentHelper {
  constructor(
    readonly rest: DiscordRestService,
    private readonly application: DiscordApplication,
    readonly response: Deferred.Deferred<{
      readonly files: ReadonlyArray<File>;
      readonly payload: Discord.CreateInteractionResponseRequest;
    }>,
  ) {}

  reply(payload?: Discord.IncomingWebhookInteractionRequest) {
    return Deferred.succeed(this.response, {
      files: [],
      payload: {
        type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data: payload,
      },
    });
  }

  replyWithFiles(files: ReadonlyArray<File>, response?: Discord.IncomingWebhookInteractionRequest) {
    return Deferred.succeed(this.response, {
      files,
      payload: {
        type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data: response,
      },
    });
  }

  update(payload?: Discord.IncomingWebhookInteractionRequest) {
    return Deferred.succeed(this.response, {
      files: [],
      payload: {
        type: Discord.InteractionCallbackTypes.UPDATE_MESSAGE,
        data: payload,
      },
    });
  }

  updateWithFiles(files: ReadonlyArray<File>, payload?: Discord.IncomingWebhookInteractionRequest) {
    return Deferred.succeed(this.response, {
      files,
      payload: {
        type: Discord.InteractionCallbackTypes.UPDATE_MESSAGE,
        data: payload,
      },
    });
  }

  deferReply(response?: Discord.IncomingWebhookInteractionRequest) {
    return Deferred.succeed(this.response, {
      files: [],
      payload: {
        type: Discord.InteractionCallbackTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: response,
      },
    });
  }

  deferUpdate(response?: Discord.IncomingWebhookInteractionRequest) {
    return Deferred.succeed(this.response, {
      files: [],
      payload: {
        type: Discord.InteractionCallbackTypes.DEFERRED_UPDATE_MESSAGE,
        data: response,
      },
    });
  }

  editReply(response: {
    readonly params?: Discord.UpdateOriginalWebhookMessageParams;
    readonly payload: Discord.IncomingWebhookUpdateRequestPartial;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const command = this;

    return Effect.gen(function* () {
      const context = yield* Ix.Interaction;

      return yield* command.rest.updateOriginalWebhookMessage(
        command.application.id,
        context.token,
        response,
      );
    });
  }

  editReplyWithFiles(
    files: ReadonlyArray<File>,
    response: {
      readonly params?: Discord.UpdateOriginalWebhookMessageParams;
      readonly payload: Discord.IncomingWebhookUpdateRequestPartial;
    },
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const command = this;

    return Effect.gen(function* () {
      const context = yield* Ix.Interaction;

      return yield* command.rest.withFiles(files)(
        command.rest.updateOriginalWebhookMessage(command.application.id, context.token, response),
      );
    });
  }
}

export const makeMessageComponentHelper = Effect.fnUntraced(function* (
  rest: DiscordRestService,
  application: DiscordApplication,
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

    yield* pipe(handler(helper), FiberMap.run(fiberMap, context.id));
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

export const makeButton = Effect.fnUntraced(function* <E = never, R = never>(
  data: { readonly custom_id: string },
  handler: (messageComponentHelper: MessageComponentHelper) => Effect.Effect<unknown, E, R>,
) {
  const rest = yield* DiscordREST;
  const application = yield* DiscordApplication;
  const forkedHandler = yield* makeForkedMessageComponentHandler(
    Effect.fnUntraced(function* (helper: MessageComponentHelper) {
      yield* handler(helper);
      yield* helper.reply({ content: "The button did not set a response." });
    }),
  );
  return {
    data,
    handler: Effect.gen(function* () {
      const helper = yield* makeMessageComponentHelper(rest, application);
      yield* forkedHandler(helper);
      const { files, payload } = yield* helper.response;
      return {
        files,
        ...payload,
      };
    }),
  };
});

export const makeMessageComponent = <E = never, R = never>(
  data: { readonly custom_id: string },
  handler: Effect.Effect<Discord.CreateInteractionResponseRequest, E, R>,
) => Ix.messageComponent(Ix.id(data.custom_id), handler);
