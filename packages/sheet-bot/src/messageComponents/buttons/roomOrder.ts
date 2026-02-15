import { Ix } from "dfx";
import { InteractionsRegistry } from "dfx/gateway";
import { bold, inlineCode, time, TimestampStyles } from "@discordjs/formatters";
import { Array, Effect, HashSet, Layer, Option, pipe } from "effect";
import { MessageRoomOrder } from "sheet-apis/schema";
import { ConverterService, FormatService, MessageRoomOrderService } from "@/services";
import { DiscordGatewayLayer } from "dfx-discord-utils/discord";
import {
  MessageComponentHelper,
  makeButton,
  makeButtonData,
  makeMessageActionRowData,
  makeMessageComponent,
} from "dfx-discord-utils/utils";
import { Interaction } from "dfx-discord-utils/utils";
import { ButtonStyle, MessageFlags } from "discord-api-types/v10";

const formatEffectValue = (effectValue: number): string => {
  const rounded = Math.round(effectValue * 10) / 10;
  const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  return `+${formatted}%`;
};

const previousButtonData = makeButtonData((b) =>
  b
    .setCustomId("interaction:roomOrder:previous")
    .setLabel("Previous")
    .setStyle(ButtonStyle.Secondary),
);

const nextButtonData = makeButtonData((b) =>
  b.setCustomId("interaction:roomOrder:next").setLabel("Next").setStyle(ButtonStyle.Secondary),
);

const sendButtonData = makeButtonData((b) =>
  b.setCustomId("interaction:roomOrder:send").setLabel("Send").setStyle(ButtonStyle.Primary),
);

export const roomOrderActionRow = (range: { minRank: number; maxRank: number }, rank: number) =>
  makeMessageActionRowData((b) =>
    b.setComponents(
      previousButtonData.setDisabled(range.minRank === rank),
      nextButtonData.setDisabled(range.maxRank === rank),
      sendButtonData,
    ),
  );

class RoomOrderHelper extends Effect.Service<RoomOrderHelper>()("RoomOrderHelper", {
  effect: pipe(
    Effect.all({
      messageRoomOrderService: MessageRoomOrderService,
      converterService: ConverterService,
      formatService: FormatService,
    }),
    Effect.map(({ messageRoomOrderService, converterService, formatService }) => ({
      roomOrderInteractionGetReply: Effect.fn("RoomOrderHelper.roomOrderInteractionGetReply")(
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
                        tags.includes("avoid_enc") ? Option.some("avoid enc") : Option.none(),
                      ],
                      Array.getSomes,
                    );

                const effectStr = effectParts.length > 0 ? ` (${effectParts.join(", ")})` : "";
                return `${inlineCode(`P${position + 1}:`)}  ${team}${effectStr}`;
              }),
              "",
              `${inlineCode("In:")} ${pipe(
                HashSet.fromIterable(messageRoomOrder.fills),
                HashSet.difference(HashSet.fromIterable(messageRoomOrder.previousFills)),
                HashSet.toValues,
                (arr) => (arr.length > 0 ? arr.join(", ") : "(none)"),
              )}`,
              `${inlineCode("Out:")} ${pipe(
                HashSet.fromIterable(messageRoomOrder.previousFills),
                HashSet.difference(HashSet.fromIterable(messageRoomOrder.fills)),
                HashSet.toValues,
                (arr) => (arr.length > 0 ? arr.join(", ") : "(none)"),
              )}`,
            ].join("\n");

            return {
              content: roomOrderContent,
              components: [
                roomOrderActionRow(messageRoomOrderRange, messageRoomOrder.rank).toJSON(),
              ],
            };
          }),
      ),
    })),
  ),
  dependencies: [MessageRoomOrderService.Default, ConverterService.Default, FormatService.Default],
  accessors: true,
}) {}

const makeRoomOrderPreviousButtonHandler = Effect.gen(function* () {
  const roomOrderHelper = yield* RoomOrderHelper;
  const messageRoomOrderService = yield* MessageRoomOrderService;

  return yield* makeButton(previousButtonData.toJSON(), (msgHelper: MessageComponentHelper) =>
    Effect.gen(function* () {
      yield* msgHelper.deferUpdate({ flags: MessageFlags.Ephemeral });

      const guild = yield* Interaction.guild();
      const message = yield* Interaction.message();

      const guildId = Option.map(guild, (g) => g.id).pipe(Option.getOrThrow);
      const messageId = Option.map(message, (m) => m.id).pipe(Option.getOrThrow);

      const decrementedRank =
        yield* messageRoomOrderService.decrementMessageRoomOrderRank(messageId);

      const reply = yield* roomOrderHelper.roomOrderInteractionGetReply(
        guildId,
        messageId,
        decrementedRank,
      );

      yield* msgHelper.editReply({ payload: reply });
    }),
  );
});

const makeRoomOrderNextButtonHandler = Effect.gen(function* () {
  const roomOrderHelper = yield* RoomOrderHelper;
  const messageRoomOrderService = yield* MessageRoomOrderService;

  return yield* makeButton(nextButtonData.toJSON(), (msgHelper: MessageComponentHelper) =>
    Effect.gen(function* () {
      yield* msgHelper.deferUpdate({ flags: MessageFlags.Ephemeral });

      const guild = yield* Interaction.guild();
      const message = yield* Interaction.message();

      const guildId = Option.map(guild, (g) => g.id).pipe(Option.getOrThrow);
      const messageId = Option.map(message, (m) => m.id).pipe(Option.getOrThrow);

      const incrementedRank =
        yield* messageRoomOrderService.incrementMessageRoomOrderRank(messageId);

      const reply = yield* roomOrderHelper.roomOrderInteractionGetReply(
        guildId,
        messageId,
        incrementedRank,
      );

      yield* msgHelper.editReply({ payload: reply });
    }),
  );
});

const makeRoomOrderSendButtonHandler = Effect.gen(function* () {
  const roomOrderHelper = yield* RoomOrderHelper;
  const messageRoomOrderService = yield* MessageRoomOrderService;

  return yield* makeButton(sendButtonData.toJSON(), (msgHelper: MessageComponentHelper) =>
    Effect.gen(function* () {
      yield* msgHelper.deferUpdate({ flags: MessageFlags.Ephemeral });

      const guild = yield* Interaction.guild();
      const message = yield* Interaction.message();

      const guildId = Option.map(guild, (g) => g.id).pipe(Option.getOrThrow);
      const messageId = Option.map(message, (m) => m.id).pipe(Option.getOrThrow);

      const messageRoomOrderData = yield* messageRoomOrderService.getMessageRoomOrder(messageId);

      const reply = yield* roomOrderHelper.roomOrderInteractionGetReply(
        guildId,
        messageId,
        messageRoomOrderData,
      );

      yield* pipe(
        message,
        Effect.transposeMapOption((m) =>
          msgHelper.rest.createMessage(m.channel_id, {
            content: reply.content,
          }),
        ),
      );

      yield* msgHelper.editReply({
        payload: {
          content: "sent room order!",
          components: [],
        },
      });
    }),
  );
});

const makeRoomOrderPreviousButton = Effect.gen(function* () {
  const button = yield* makeRoomOrderPreviousButtonHandler;

  return makeMessageComponent(button.data, button.handler);
});

const makeRoomOrderNextButton = Effect.gen(function* () {
  const button = yield* makeRoomOrderNextButtonHandler;

  return makeMessageComponent(button.data, button.handler);
});

const makeRoomOrderSendButton = Effect.gen(function* () {
  const button = yield* makeRoomOrderSendButtonHandler;

  return makeMessageComponent(button.data, button.handler);
});

export const RoomOrderButtonLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const previousButton = yield* makeRoomOrderPreviousButton;
    const nextButton = yield* makeRoomOrderNextButton;
    const sendButton = yield* makeRoomOrderSendButton;

    yield* registry.register(
      Ix.builder.add(previousButton).add(nextButton).add(sendButton).catchAllCause(Effect.log),
    );
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      DiscordGatewayLayer,
      MessageRoomOrderService.Default,
      ConverterService.Default,
      FormatService.Default,
      RoomOrderHelper.Default,
    ),
  ),
);
