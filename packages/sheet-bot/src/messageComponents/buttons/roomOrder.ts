import {
  ButtonInteractionT,
  CachedInteractionContext,
  channelServicesFromInteraction,
  ConverterService,
  FormatService,
  guildSheetServicesFromInteraction,
  InteractionContext,
  MessageRoomOrder,
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
import { Effect, Function, Layer, Number, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";

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
  messageRoomOrder: MessageRoomOrder,
) =>
  pipe(
    Effect.Do,
    CachedInteractionContext.message<ButtonInteractionT>().bind("message"),
    Effect.bindAll(
      ({ message }) => ({
        messageRoomOrderRange: pipe(
          MessageRoomOrderService.getMessageRoomOrderRange(message.id),
          Effect.flatMap(observeOnce),
          Effect.flatMap(Function.identity),
        ),
        messageRoomOrderData: pipe(
          MessageRoomOrderService.getMessageRoomOrderData(
            message.id,
            messageRoomOrder.rank,
          ),
          Effect.flatMap(observeOnce),
        ),
        formattedHourWindow: pipe(
          ConverterService.convertHourToHourWindow(messageRoomOrder.hour),
          Effect.flatMap(FormatService.formatHourWindow),
        ),
      }),
      { concurrency: "unbounded" },
    ),
    Effect.map(
      ({
        messageRoomOrderData,
        messageRoomOrderRange,
        formattedHourWindow: { start, end },
      }) => ({
        content: [
          `${bold(`Hour ${messageRoomOrder.hour}`)} ${time(start, TimestampStyles.ShortDateTime)} - ${time(end, TimestampStyles.ShortDateTime)}`,
          "",
          ...messageRoomOrderData.map(
            ({ team, tags, position }) =>
              `${inlineCode(`P${position + 1}:`)}  ${team}${tags.includes("enc") ? " (enc)" : ""}`,
          ),
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
      Effect.provide(guildSheetServicesFromInteraction())(
        pipe(
          Effect.Do,
          InteractionContext.deferUpdate.tap(),
          CachedInteractionContext.message<ButtonInteractionT>().bind(
            "message",
          ),
          bindObject({
            eventConfig: SheetService.getEventConfig(),
          }),
          Effect.bind("messageRoomOrder", ({ message }) =>
            pipe(
              MessageRoomOrderService.decrementMessageRoomOrderRank(message.id),
              Effect.flatMap(Function.identity),
            ),
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
      Effect.provide(guildSheetServicesFromInteraction())(
        pipe(
          Effect.Do,
          InteractionContext.deferUpdate.tap(),
          CachedInteractionContext.message<ButtonInteractionT>().bind(
            "message",
          ),
          bindObject({
            eventConfig: SheetService.getEventConfig(),
          }),
          Effect.bind("messageRoomOrder", ({ message }) =>
            pipe(
              MessageRoomOrderService.incrementMessageRoomOrderRank(message.id),
              Effect.flatMap(Function.identity),
            ),
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
          guildSheetServicesFromInteraction(),
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
            eventConfig: SheetService.getEventConfig(),
          }),
          Effect.bind("messageRoomOrder", ({ message }) =>
            pipe(
              MessageRoomOrderService.getMessageRoomOrder(message.id),
              Effect.flatMap(observeOnce),
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
