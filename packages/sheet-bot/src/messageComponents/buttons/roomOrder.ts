import { InteractionsRegistry } from "dfx/gateway";
import { bold, inlineCode, time, TimestampStyles } from "@discordjs/formatters";
import { MessageFlags } from "discord-api-types/v10";
import { Ix } from "dfx/index";
import { Array, Effect, HashSet, Layer, Option, pipe } from "effect";
import { Interaction, makeButton, makeMessageComponent } from "dfx-discord-utils/utils";
import { MessageRoomOrder } from "sheet-apis/schema";
import { discordGatewayLayer } from "../../discord/gateway";
import {
  nextButtonData,
  previousButtonData,
  roomOrderActionRow,
  sendButtonData,
  tentativePinButtonData,
  tentativeRoomOrderActionRow,
} from "./roomOrderComponents";
import {
  ConverterService,
  HourWindow,
  FormatService,
  FormattedHourWindow,
  MessageRoomOrderService,
  PermissionService,
  SheetApisRequestContext,
} from "@/services";

const formatEffectValue = (effectValue: number): string => {
  const rounded = Math.round(effectValue * 10) / 10;
  const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  return `+${formatted}%`;
};

const getInteractionGuildId = Effect.gen(function* () {
  const interactionGuild = yield* Interaction.guild();
  return pipe(
    interactionGuild,
    Option.map((guild) => (guild as { id: string }).id),
  );
});

const getInteractionMessage = Effect.gen(function* () {
  const interactionMessage = yield* Interaction.message();
  return pipe(
    interactionMessage,
    Option.map((message) => message as { id: string; channel_id: string }),
  );
});

const renderDelta = (current: ReadonlyArray<string>, previous: ReadonlyArray<string>) => {
  const values = globalThis.Array.from(
    pipe(HashSet.fromIterable(current), HashSet.difference(HashSet.fromIterable(previous))),
  );
  return values.length > 0 ? values.join(", ") : "(none)";
};

const makeRoomOrderReply = (
  converterService: {
    convertHourToHourWindow: (
      guildId: string,
      hour: number,
    ) => Effect.Effect<HourWindow, unknown, unknown>;
  },
  formatService: {
    formatHourWindow: (
      hourWindow: HourWindow,
    ) => Effect.Effect<FormattedHourWindow, unknown, unknown>;
  },
  messageRoomOrderService: {
    getMessageRoomOrderRange: (
      messageId: string,
    ) => Effect.Effect<{ minRank: number; maxRank: number }, unknown, unknown>;
    getMessageRoomOrderEntry: (
      messageId: string,
      rank: string,
    ) => Effect.Effect<
      ReadonlyArray<{
        team: string;
        tags: ReadonlyArray<string>;
        position: number;
        effectValue: number;
      }>,
      unknown,
      unknown
    >;
  },
) =>
  Effect.fn("roomOrderButton.getReply")(
    (guildId: string, messageId: string, messageRoomOrder: MessageRoomOrder.MessageRoomOrder) =>
      Effect.gen(function* () {
        const messageRoomOrderRange =
          yield* messageRoomOrderService.getMessageRoomOrderRange(messageId);
        const messageRoomOrderEntry = yield* messageRoomOrderService.getMessageRoomOrderEntry(
          messageId,
          messageRoomOrder.rank.toString(),
        );
        const { start, end } = yield* pipe(
          converterService.convertHourToHourWindow(guildId, messageRoomOrder.hour),
          Effect.flatMap(formatService.formatHourWindow),
        );

        const roomOrderContent = [
          `${bold(`Hour ${messageRoomOrder.hour}`)} ${time(start, TimestampStyles.LongDateShortTime)} - ${time(end, TimestampStyles.LongDateShortTime)}`,
          ...Option.match(messageRoomOrder.monitor, {
            onNone: () => [],
            onSome: (monitor) => [`${inlineCode("Monitor:")} ${monitor}`],
          }),
          "",
          ...messageRoomOrderEntry.map(({ team, tags, position, effectValue }) => {
            const hasTiererTag = tags.includes("tierer");
            const effectParts = hasTiererTag
              ? []
              : pipe(
                  [
                    Option.some(formatEffectValue(effectValue)),
                    tags.includes("enc") ? Option.some("enc") : Option.none(),
                    tags.includes("not_enc") ? Option.some("not enc") : Option.none(),
                  ],
                  Array.getSomes,
                );

            const effectStr = effectParts.length > 0 ? ` (${effectParts.join(", ")})` : "";
            return `${inlineCode(`P${position + 1}:`)}  ${team}${effectStr}`;
          }),
          "",
          `${inlineCode("In:")} ${renderDelta(messageRoomOrder.fills, messageRoomOrder.previousFills)}`,
          `${inlineCode("Out:")} ${renderDelta(messageRoomOrder.previousFills, messageRoomOrder.fills)}`,
        ].join("\n");

        return {
          content: roomOrderContent,
          components: [roomOrderActionRow(messageRoomOrderRange, messageRoomOrder.rank).toJSON()],
        };
      }),
  );

const makeRoomOrderPreviousButtonHandler = Effect.gen(function* () {
  const converterService = yield* ConverterService;
  const formatService = yield* FormatService;
  const messageRoomOrderService = yield* MessageRoomOrderService;
  const roomOrderReply = makeRoomOrderReply(
    converterService,
    formatService,
    messageRoomOrderService,
  );

  return yield* makeButton(
    previousButtonData.toJSON(),
    SheetApisRequestContext.asInteractionUser(
      Effect.fn("roomOrderPreviousButton")(function* (msgHelper) {
        yield* msgHelper.deferUpdate({ flags: MessageFlags.Ephemeral });

        const guildId = Option.getOrThrowWith(
          yield* getInteractionGuildId,
          () => new Error("Guild not found in interaction"),
        );
        const message = Option.getOrThrowWith(
          yield* getInteractionMessage,
          () => new Error("Message not found in interaction"),
        );

        const decrementedRank = yield* messageRoomOrderService.decrementMessageRoomOrderRank(
          message.id,
        );
        const reply = yield* roomOrderReply(guildId, message.id, decrementedRank);

        yield* msgHelper.editReply({ payload: reply });
      }),
    ),
  );
});

const makeRoomOrderNextButtonHandler = Effect.gen(function* () {
  const converterService = yield* ConverterService;
  const formatService = yield* FormatService;
  const messageRoomOrderService = yield* MessageRoomOrderService;
  const roomOrderReply = makeRoomOrderReply(
    converterService,
    formatService,
    messageRoomOrderService,
  );

  return yield* makeButton(
    nextButtonData.toJSON(),
    SheetApisRequestContext.asInteractionUser(
      Effect.fn("roomOrderNextButton")(function* (msgHelper) {
        yield* msgHelper.deferUpdate({ flags: MessageFlags.Ephemeral });

        const guildId = Option.getOrThrowWith(
          yield* getInteractionGuildId,
          () => new Error("Guild not found in interaction"),
        );
        const message = Option.getOrThrowWith(
          yield* getInteractionMessage,
          () => new Error("Message not found in interaction"),
        );

        const incrementedRank = yield* messageRoomOrderService.incrementMessageRoomOrderRank(
          message.id,
        );
        const reply = yield* roomOrderReply(guildId, message.id, incrementedRank);

        yield* msgHelper.editReply({ payload: reply });
      }),
    ),
  );
});

const makeRoomOrderSendButtonHandler = Effect.gen(function* () {
  const converterService = yield* ConverterService;
  const formatService = yield* FormatService;
  const messageRoomOrderService = yield* MessageRoomOrderService;
  const roomOrderReply = makeRoomOrderReply(
    converterService,
    formatService,
    messageRoomOrderService,
  );

  return yield* makeButton(
    sendButtonData.toJSON(),
    SheetApisRequestContext.asInteractionUser(
      Effect.fn("roomOrderSendButton")(function* (msgHelper) {
        yield* msgHelper.deferUpdate({ flags: MessageFlags.Ephemeral });

        const guildId = Option.getOrThrowWith(
          yield* getInteractionGuildId,
          () => new Error("Guild not found in interaction"),
        );
        const message = Option.getOrThrowWith(
          yield* getInteractionMessage,
          () => new Error("Message not found in interaction"),
        );
        const messageRoomOrderData = yield* messageRoomOrderService.getMessageRoomOrder(message.id);
        const reply = yield* roomOrderReply(guildId, message.id, messageRoomOrderData);

        const sentMessage = yield* msgHelper.rest.createMessage(message.channel_id, {
          content: reply.content,
        });

        const pinned = yield* msgHelper.rest.createPin(sentMessage.channel_id, sentMessage.id).pipe(
          Effect.as(true),
          Effect.catchCause((cause) =>
            Effect.logError("Failed to pin sent room order").pipe(
              Effect.annotateLogs({
                guildId,
                channelId: sentMessage.channel_id,
                messageId: sentMessage.id,
              }),
              Effect.andThen(Effect.logError(cause)),
              Effect.as(false),
            ),
          ),
        );

        yield* msgHelper.editReply({
          payload: {
            content: pinned
              ? "sent room order and pinned it!"
              : "sent room order, but failed to pin it.",
            components: [],
          },
        });
      }),
    ),
  );
});

const makeTentativeRoomOrderPinButtonHandler = Effect.gen(function* () {
  const permissionService = yield* PermissionService;

  return yield* makeButton(
    tentativePinButtonData.toJSON(),
    SheetApisRequestContext.asInteractionUser(
      Effect.fn("roomOrderTentativePinButton")(function* (helper) {
        yield* helper.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = Option.getOrThrowWith(
          yield* getInteractionGuildId,
          () => new Error("Guild not found in interaction"),
        );
        const message = Option.getOrThrowWith(
          yield* getInteractionMessage,
          () => new Error("Message not found in interaction"),
        );

        yield* permissionService.checkInteractionUserMonitorGuild(guildId);
        const pinned = yield* helper.rest.createPin(message.channel_id, message.id).pipe(
          Effect.as(true),
          Effect.catchCause((cause) =>
            Effect.logError("Failed to pin tentative room order").pipe(
              Effect.annotateLogs({
                guildId,
                channelId: message.channel_id,
                messageId: message.id,
              }),
              Effect.andThen(Effect.logError(cause)),
              Effect.as(false),
            ),
          ),
        );

        if (pinned) {
          yield* helper.rest
            .updateMessage(message.channel_id, message.id, {
              components: [tentativeRoomOrderActionRow(true).toJSON()],
            })
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logError("Failed to disable tentative room order pin button").pipe(
                  Effect.annotateLogs({
                    guildId,
                    channelId: message.channel_id,
                    messageId: message.id,
                  }),
                  Effect.andThen(Effect.logError(cause)),
                ),
              ),
            );
        }

        yield* helper.editReply({
          payload: {
            content: pinned
              ? "pinned tentative room order!"
              : "tentative room order could not be pinned.",
          },
        });
      }),
    ),
  );
});

const makeRoomOrderPreviousButton = Effect.gen(function* () {
  const button = yield* makeRoomOrderPreviousButtonHandler;
  return makeMessageComponent(button.data, button.handler as never);
});

const makeRoomOrderNextButton = Effect.gen(function* () {
  const button = yield* makeRoomOrderNextButtonHandler;
  return makeMessageComponent(button.data, button.handler as never);
});

const makeRoomOrderSendButton = Effect.gen(function* () {
  const button = yield* makeRoomOrderSendButtonHandler;
  return makeMessageComponent(button.data, button.handler as never);
});

const makeTentativeRoomOrderPinButton = Effect.gen(function* () {
  const button = yield* makeTentativeRoomOrderPinButtonHandler;
  return makeMessageComponent(button.data, button.handler as never);
});

export const roomOrderButtonLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const previousButton = yield* makeRoomOrderPreviousButton;
    const nextButton = yield* makeRoomOrderNextButton;
    const sendButton = yield* makeRoomOrderSendButton;
    const tentativePinButton = yield* makeTentativeRoomOrderPinButton;

    yield* registry.register(Ix.builder.add(previousButton).catchAllCause(Effect.log));
    yield* registry.register(Ix.builder.add(nextButton).catchAllCause(Effect.log));
    yield* registry.register(Ix.builder.add(sendButton).catchAllCause(Effect.log));
    yield* registry.register(Ix.builder.add(tentativePinButton).catchAllCause(Effect.log));
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      discordGatewayLayer,
      MessageRoomOrderService.layer,
      ConverterService.layer,
      FormatService.layer,
      PermissionService.layer,
    ),
  ),
);
