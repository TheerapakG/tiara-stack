import {
  ButtonInteractionT,
  CachedInteractionContext,
  channelServicesFromInteraction,
  ConverterService,
  FormatService,
  guildServicesFromInteraction,
  InteractionContext,
  MessageRoomOrderService,
  SendableChannelContext,
  SheetService,
} from "@/services";
import { ButtonHandlerVariantT, handlerVariantContextBuilder } from "@/types";
import { bindObject } from "@/utils";
import {
  ActionRowBuilder,
  bold,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  inlineCode,
  InteractionButtonComponentData,
  MessageActionRowComponentBuilder,
  time,
  TimestampStyles,
} from "discord.js";
import {
  Array,
  Effect,
  Function,
  HashSet,
  Layer,
  Number,
  Option,
  pipe,
} from "effect";
import { Schema } from "sheet-apis";
import { UntilObserver } from "typhoon-core/signal";

const formatEffectValue = (effectValue: number): string => {
  const rounded = Math.round(effectValue * 10) / 10;
  const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  return `+${formatted}%`;
};

const roomOrderPreviousButtonData = {
  type: ComponentType.Button,
  customId: "interaction:roomOrder:Previous",
  label: "Previous",
  style: ButtonStyle.Secondary,
} as const satisfies InteractionButtonComponentData;

const roomOrderNextButtonData = {
  type: ComponentType.Button,
  customId: "interaction:roomOrder:Next",
  label: "Next",
  style: ButtonStyle.Secondary,
} as const satisfies InteractionButtonComponentData;

const roomOrderSendButtonData = {
  type: ComponentType.Button,
  customId: "interaction:roomOrder:Send",
  label: "Send",
  style: ButtonStyle.Primary,
} as const satisfies InteractionButtonComponentData;

export const roomOrderActionRow = (
  range: { minRank: number; maxRank: number },
  rank: number,
) =>
  new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new ButtonBuilder(roomOrderPreviousButtonData).setDisabled(
        Number.Equivalence(range.minRank, rank),
      ),
    )
    .addComponents(
      new ButtonBuilder(roomOrderNextButtonData).setDisabled(
        Number.Equivalence(range.maxRank, rank),
      ),
    )
    .addComponents(new ButtonBuilder(roomOrderSendButtonData));

export const roomOrderInteractionGetReply = (
  messageRoomOrder: Schema.MessageRoomOrder,
) =>
  pipe(
    Effect.Do,
    CachedInteractionContext.message<ButtonInteractionT>().bind("message"),
    Effect.bind("messageRoomOrderRange", ({ message }) =>
      pipe(
        MessageRoomOrderService.getMessageRoomOrderRange(message.id),
        UntilObserver.observeUntilRpcResultResolved(),
        Effect.flatMap(Function.identity),
      ),
    ),
    Effect.bind("messageRoomOrderEntry", ({ message }) =>
      pipe(
        MessageRoomOrderService.getMessageRoomOrderEntry(
          message.id,
          messageRoomOrder.rank,
        ),
        UntilObserver.observeUntilRpcResultResolved(),
      ),
    ),
    Effect.bind("formattedHourWindow", () =>
      pipe(
        ConverterService.convertHourToHourWindow(messageRoomOrder.hour),
        Effect.flatMap(FormatService.formatHourWindow),
      ),
    ),
    Effect.map(
      ({
        messageRoomOrderEntry,
        messageRoomOrderRange,
        formattedHourWindow: { start, end },
      }) => ({
        content: [
          `${bold(`Hour ${messageRoomOrder.hour}`)} ${time(start, TimestampStyles.ShortDateTime)} - ${time(end, TimestampStyles.ShortDateTime)}`,
          ...pipe(
            messageRoomOrder.monitor,
            Option.match({
              onNone: () => [],
              onSome: (monitor) => [`${inlineCode("Monitor:")} ${monitor}`],
            }),
          ),
          "",
          ...pipe(
            messageRoomOrderEntry,
            Array.map(({ team, tags, position, effectValue }) => {
              const hasTiererTag = tags.includes("tierer");
              const effectParts = hasTiererTag
                ? []
                : pipe(
                    [
                      Option.some(formatEffectValue(effectValue)),
                      tags.includes("enc") ? Option.some("enc") : Option.none(),
                      tags.includes("doormat")
                        ? Option.some("doormat")
                        : Option.none(),
                    ],
                    Array.getSomes,
                  );
              const effectStr =
                effectParts.length > 0
                  ? ` (${Array.join(effectParts, ", ")})`
                  : "";
              return `${inlineCode(`P${position + 1}:`)}  ${team}${effectStr}`;
            }),
          ),
          "",
          `${inlineCode("In:")} ${pipe(
            HashSet.fromIterable(messageRoomOrder.fills),
            HashSet.difference(messageRoomOrder.previousFills),
            HashSet.toValues,
            Array.join(", "),
          )}`,
          `${inlineCode("Out:")} ${pipe(
            HashSet.fromIterable(messageRoomOrder.previousFills),
            HashSet.difference(messageRoomOrder.fills),
            HashSet.toValues,
            Array.join(", "),
          )}`,
        ].join("\n"),
        components: [
          roomOrderActionRow(messageRoomOrderRange, messageRoomOrder.rank),
        ],
      }),
    ),
    Effect.withSpan("roomOrderInteractionGetReply", {
      captureStackTrace: true,
    }),
  );

export const roomOrderPreviousButton =
  handlerVariantContextBuilder<ButtonHandlerVariantT>()
    .data(roomOrderPreviousButtonData)
    .handler(
      Effect.provide(guildServicesFromInteraction())(
        pipe(
          Effect.Do,
          InteractionContext.deferUpdate.tap(),
          CachedInteractionContext.message<ButtonInteractionT>().bind(
            "message",
          ),
          bindObject({
            eventConfig: SheetService.eventConfig(),
          }),
          Effect.bind("messageRoomOrder", ({ message }) =>
            MessageRoomOrderService.decrementMessageRoomOrderRank(message.id),
          ),
          Effect.bind("messageRoomOrderReply", ({ messageRoomOrder }) =>
            roomOrderInteractionGetReply(messageRoomOrder),
          ),
          InteractionContext.editReply.tap(
            ({ messageRoomOrderReply }) => messageRoomOrderReply,
          ),
          Effect.asVoid,
          Effect.withSpan("handleRoomOrderPreviousButton", {
            captureStackTrace: true,
          }),
        ),
      ),
    )
    .build();

export const roomOrderNextButton =
  handlerVariantContextBuilder<ButtonHandlerVariantT>()
    .data(roomOrderNextButtonData)
    .handler(
      Effect.provide(guildServicesFromInteraction())(
        pipe(
          Effect.Do,
          InteractionContext.deferUpdate.tap(),
          CachedInteractionContext.message<ButtonInteractionT>().bind(
            "message",
          ),
          bindObject({
            eventConfig: SheetService.eventConfig(),
          }),
          Effect.bind("messageRoomOrder", ({ message }) =>
            MessageRoomOrderService.incrementMessageRoomOrderRank(message.id),
          ),
          Effect.bind("messageRoomOrderReply", ({ messageRoomOrder }) =>
            roomOrderInteractionGetReply(messageRoomOrder),
          ),
          InteractionContext.editReply.tap(
            ({ messageRoomOrderReply }) => messageRoomOrderReply,
          ),
          Effect.asVoid,
          Effect.withSpan("handleRoomOrderNextButton", {
            captureStackTrace: true,
          }),
        ),
      ),
    )
    .build();

export const roomOrderSendButton =
  handlerVariantContextBuilder<ButtonHandlerVariantT>()
    .data(roomOrderSendButtonData)
    .handler(
      Effect.provide(
        Layer.mergeAll(
          guildServicesFromInteraction(),
          channelServicesFromInteraction(),
        ),
      )(
        pipe(
          Effect.Do,
          InteractionContext.deferUpdate.tap(),
          CachedInteractionContext.message<ButtonInteractionT>().bind(
            "message",
          ),
          bindObject({
            eventConfig: SheetService.eventConfig(),
          }),
          Effect.bind("messageRoomOrder", ({ message }) =>
            pipe(
              MessageRoomOrderService.getMessageRoomOrder(message.id),
              UntilObserver.observeUntilRpcResultResolved(),
              Effect.flatMap(Function.identity),
            ),
          ),
          Effect.bind("messageRoomOrderReply", ({ messageRoomOrder }) =>
            roomOrderInteractionGetReply(messageRoomOrder),
          ),
          SendableChannelContext.send().tap(({ messageRoomOrderReply }) => ({
            content: messageRoomOrderReply.content,
          })),
          InteractionContext.editReply.tap(() => ({
            content: "sent room order!",
            components: [],
          })),
          Effect.asVoid,
          Effect.withSpan("handleRoomOrderSendButton", {
            captureStackTrace: true,
          }),
        ),
      ),
    )
    .build();
