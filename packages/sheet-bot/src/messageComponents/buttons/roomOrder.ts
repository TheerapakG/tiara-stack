import {
  ActionRowBuilder,
  bold,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  inlineCode,
  InteractionButtonComponentData,
  MessageActionRowComponentBuilder,
} from "discord.js";
import { Effect, Function, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import {
  ButtonInteractionT,
  CachedInteractionContext,
  channelServicesFromInteraction,
  guildServicesFromInteraction,
  InteractionContext,
  MessageRoomOrderService,
  SendableChannelContext,
} from "../../services";
import { buttonInteractionHandlerContextBuilder } from "../../types";
import { bindObject } from "../../utils";

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

export const roomOrderPreviousButton = buttonInteractionHandlerContextBuilder()
  .data(roomOrderPreviousButtonData)
  .handler(
    Effect.provide(guildServicesFromInteraction())(
      pipe(
        Effect.Do,
        InteractionContext.tapDeferUpdate(),
        bindObject({
          message: CachedInteractionContext.message<ButtonInteractionT>(),
        }),
        Effect.bindAll(
          ({ message }) => ({
            messageRoomOrder: pipe(
              MessageRoomOrderService.decrementMessageRoomOrderRank(message.id),
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
        InteractionContext.tapEditReply(
          ({
            messageRoomOrderData,
            messageRoomOrderRange,
            messageRoomOrder,
          }) => ({
            content: messageRoomOrderData
              .map(
                ({ team, tags, position }) =>
                  `${inlineCode(`P${position + 1}:`)}  ${bold(team)}${tags.includes("enc") ? " (enc)" : ""}`,
              )
              .join("\n"),
            components: [
              roomOrderActionRow(messageRoomOrderRange, messageRoomOrder.rank),
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

export const roomOrderNextButton = buttonInteractionHandlerContextBuilder()
  .data(roomOrderNextButtonData)
  .handler(
    Effect.provide(guildServicesFromInteraction())(
      pipe(
        Effect.Do,
        InteractionContext.tapDeferUpdate(),
        bindObject({
          message: CachedInteractionContext.message<ButtonInteractionT>(),
        }),
        Effect.bindAll(
          ({ message }) => ({
            messageRoomOrder: pipe(
              MessageRoomOrderService.incrementMessageRoomOrderRank(message.id),
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
        InteractionContext.tapEditReply(
          ({
            messageRoomOrderData,
            messageRoomOrderRange,
            messageRoomOrder,
          }) => ({
            content: messageRoomOrderData
              .map(
                ({ team, tags, position }) =>
                  `${inlineCode(`P${position + 1}:`)}  ${bold(team)}${tags.includes("enc") ? " (enc)" : ""}`,
              )
              .join("\n"),
            components: [
              roomOrderActionRow(messageRoomOrderRange, messageRoomOrder.rank),
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

export const roomOrderSendButton = buttonInteractionHandlerContextBuilder()
  .data(roomOrderSendButtonData)
  .handler(
    Effect.provide(guildServicesFromInteraction())(
      pipe(
        Effect.Do,
        InteractionContext.tapDeferUpdate(),
        bindObject({
          message: CachedInteractionContext.message<ButtonInteractionT>(),
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
        Effect.tap(({ messageRoomOrderData }) =>
          pipe(
            SendableChannelContext.send({
              content: messageRoomOrderData
                .map(
                  ({ team, tags, position }) =>
                    `${inlineCode(`P${position + 1}:`)}  ${bold(team)}${tags.includes("enc") ? " (enc)" : ""}`,
                )
                .join("\n"),
            }),
            Effect.provide(channelServicesFromInteraction()),
          ),
        ),
        InteractionContext.tapEditReply(() => ({
          content: "sent room order!",
        })),
        Effect.asVoid,
        Effect.withSpan("handleRoomOrderSendButton", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();
