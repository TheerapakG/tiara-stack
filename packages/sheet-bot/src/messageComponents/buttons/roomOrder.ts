import {
  ButtonInteractionT,
  CachedInteractionContext,
  channelServicesFromInteraction,
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
import { Effect, Function, Layer, pipe } from "effect";
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
        range.minRank === rank,
      ),
    )
    .addComponents(
      new ButtonBuilder(roomOrderNextButtonData).setDisabled(
        range.maxRank === rank,
      ),
    )
    .addComponents(new ButtonBuilder(roomOrderSendButtonData));

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
            eventConfig: SheetService.getEventConfig(),
          }),
          Effect.bindAll(
            ({ message }) => ({
              messageRoomOrder: pipe(
                MessageRoomOrderService.decrementMessageRoomOrderRank(
                  message.id,
                ),
                Effect.flatMap(Function.identity),
              ),
              messageRoomOrderRange: pipe(
                MessageRoomOrderService.getMessageRoomOrderRange(message.id),
                Effect.flatMap(observeOnce),
                Effect.flatMap(Function.identity),
              ),
            }),
            { concurrency: "unbounded" },
          ),
          Effect.bind("messageRoomOrderData", ({ message, messageRoomOrder }) =>
            pipe(
              MessageRoomOrderService.getMessageRoomOrderData(
                message.id,
                messageRoomOrder.rank,
              ),
              Effect.flatMap(observeOnce),
            ),
          ),
          Effect.bind("formattedHour", ({ messageRoomOrder }) =>
            FormatService.formatHour(messageRoomOrder.hour),
          ),
          InteractionContext.editReply.tap(
            ({
              messageRoomOrderData,
              messageRoomOrderRange,
              messageRoomOrder,
              formattedHour,
            }) => ({
              content: [
                `${bold(`Hour ${messageRoomOrder.hour}`)} ${time(formattedHour.start, TimestampStyles.ShortDateTime)} - ${time(formattedHour.end, TimestampStyles.ShortDateTime)}`,
                "",
                messageRoomOrderData.map(
                  ({ team, tags, position }) =>
                    `${inlineCode(`P${position + 1}:`)}  ${bold(team)}${tags.includes("enc") ? " (enc)" : ""}`,
                ),
              ].join("\n"),
              components: [
                roomOrderActionRow(
                  messageRoomOrderRange,
                  messageRoomOrder.rank,
                ),
              ],
            }),
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
            eventConfig: SheetService.getEventConfig(),
          }),
          Effect.bindAll(
            ({ message }) => ({
              messageRoomOrder: pipe(
                MessageRoomOrderService.incrementMessageRoomOrderRank(
                  message.id,
                ),
                Effect.flatMap(Function.identity),
              ),
              messageRoomOrderRange: pipe(
                MessageRoomOrderService.getMessageRoomOrderRange(message.id),
                Effect.flatMap(observeOnce),
                Effect.flatMap(Function.identity),
              ),
            }),
            { concurrency: "unbounded" },
          ),
          Effect.bind("messageRoomOrderData", ({ message, messageRoomOrder }) =>
            pipe(
              MessageRoomOrderService.getMessageRoomOrderData(
                message.id,
                messageRoomOrder.rank,
              ),
              Effect.flatMap(observeOnce),
            ),
          ),
          Effect.bind("formattedHour", ({ messageRoomOrder }) =>
            FormatService.formatHour(messageRoomOrder.hour),
          ),
          InteractionContext.editReply.tap(
            ({
              messageRoomOrderData,
              messageRoomOrderRange,
              messageRoomOrder,
              formattedHour,
            }) => ({
              content: [
                `${bold(`Hour ${messageRoomOrder.hour}`)} ${time(formattedHour.start, TimestampStyles.ShortDateTime)} - ${time(formattedHour.end, TimestampStyles.ShortDateTime)}`,
                "",
                messageRoomOrderData.map(
                  ({ team, tags, position }) =>
                    `${inlineCode(`P${position + 1}:`)}  ${bold(team)}${tags.includes("enc") ? " (enc)" : ""}`,
                ),
              ].join("\n"),
              components: [
                roomOrderActionRow(
                  messageRoomOrderRange,
                  messageRoomOrder.rank,
                ),
              ],
            }),
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
            eventConfig: SheetService.getEventConfig(),
          }),
          Effect.bindAll(
            ({ message }) => ({
              messageRoomOrder: pipe(
                MessageRoomOrderService.getMessageRoomOrder(message.id),
                Effect.flatMap(observeOnce),
                Effect.flatMap(Function.identity),
              ),
              messageRoomOrderRange: pipe(
                MessageRoomOrderService.getMessageRoomOrderRange(message.id),
                Effect.flatMap(observeOnce),
                Effect.flatMap(Function.identity),
              ),
            }),
            { concurrency: "unbounded" },
          ),
          Effect.bind("messageRoomOrderData", ({ message, messageRoomOrder }) =>
            pipe(
              MessageRoomOrderService.getMessageRoomOrderData(
                message.id,
                messageRoomOrder.rank,
              ),
              Effect.flatMap(observeOnce),
            ),
          ),
          SendableChannelContext.send().tap(
            ({ messageRoomOrderData, eventConfig, messageRoomOrder }) => ({
              content: [
                `${bold(`Hour ${messageRoomOrder.hour}`)} ${time(eventConfig.startTime + (messageRoomOrder.hour - 1) * 3600, TimestampStyles.ShortDateTime)} - ${time(eventConfig.startTime + messageRoomOrder.hour * 3600, TimestampStyles.ShortDateTime)}`,
                "",
                ...messageRoomOrderData.map(
                  ({ team, tags, position }) =>
                    `${inlineCode(`P${position + 1}:`)}  ${bold(team)}${tags.includes("enc") ? " (enc)" : ""}`,
                ),
              ].join("\n"),
            }),
          ),
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
