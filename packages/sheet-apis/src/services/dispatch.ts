import { Context, Effect, Layer, Schema } from "effect";
import { DiscordMessageRequestSchema } from "dfx-discord-utils/discord/schema";
import {
  formatTentativeRoomOrderContent,
  shouldSendTentativeRoomOrder,
} from "sheet-ingress-api/discordComponents";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import type {
  CheckinDispatchPayload,
  CheckinDispatchResult,
  RoomOrderDispatchPayload,
  RoomOrderDispatchResult,
} from "sheet-ingress-api/sheet-apis-rpc";
import { CheckinService } from "./checkin";
import {
  checkinActionRow,
  roomOrderActionRow,
  tentativeRoomOrderActionRow,
  tentativeRoomOrderPinActionRow,
} from "./discordComponents";
import { IngressBotClient } from "./ingressBotClient";
import { MessageCheckinService } from "./messageCheckin";
import { MessageRoomOrderService } from "./messageRoomOrder";
import { RoomOrderService } from "./roomOrder";

const MessageFlags = {
  Ephemeral: 64,
} as const;

type DiscordMessage = {
  readonly id: string;
  readonly channel_id: string;
};

type MessagePayload = Schema.Schema.Type<typeof DiscordMessageRequestSchema>;

type DispatchMessageSink = {
  readonly sendPrimary: (
    payload: MessagePayload,
  ) => Effect.Effect<DiscordMessage, unknown, unknown>;
  readonly updatePrimary: (
    message: DiscordMessage,
    payload: MessagePayload,
  ) => Effect.Effect<DiscordMessage, unknown, unknown>;
};

const logEnableFailure = (message: string) => (error: unknown) =>
  Effect.logWarning(message).pipe(Effect.annotateLogs({ cause: String(error) }));

const makeInteractionMessageSink = (
  botClient: typeof IngressBotClient.Service,
  interactionToken: string,
): DispatchMessageSink => ({
  sendPrimary: (payload) => botClient.updateOriginalInteractionResponse(interactionToken, payload),
  updatePrimary: (_message, payload) =>
    botClient.updateOriginalInteractionResponse(interactionToken, payload),
});

const makeChannelMessageSink = (
  botClient: typeof IngressBotClient.Service,
  channelId: string,
): DispatchMessageSink => ({
  sendPrimary: (payload) => botClient.sendMessage(channelId, payload),
  updatePrimary: (message, payload) =>
    botClient.updateMessage(message.channel_id, message.id, payload),
});

const makeMessageSink = (
  botClient: typeof IngressBotClient.Service,
  channelId: string,
  interactionToken: string | undefined,
): DispatchMessageSink =>
  typeof interactionToken === "string"
    ? makeInteractionMessageSink(botClient, interactionToken)
    : makeChannelMessageSink(botClient, channelId);

const sendTentativeRoomOrder = Effect.fn("DispatchService.sendTentativeRoomOrder")(function* ({
  guildId,
  runningChannelId,
  hour,
  fillCount,
  createdByUserId,
  botClient,
  roomOrderService,
  messageRoomOrderService,
}: {
  readonly guildId: string;
  readonly runningChannelId: string;
  readonly hour: number;
  readonly fillCount: number;
  readonly createdByUserId: string | null;
  readonly botClient: typeof IngressBotClient.Service;
  readonly roomOrderService: typeof RoomOrderService.Service;
  readonly messageRoomOrderService: typeof MessageRoomOrderService.Service;
}) {
  if (!shouldSendTentativeRoomOrder(fillCount)) {
    return null;
  }

  return yield* Effect.gen(function* () {
    const generated = yield* roomOrderService.generate({
      guildId,
      channelId: runningChannelId,
      hour,
    });

    const sentMessage = yield* botClient.sendMessage(runningChannelId, {
      content: formatTentativeRoomOrderContent(generated.content),
      components: [tentativeRoomOrderActionRow(generated.range, generated.rank)],
    });

    yield* Effect.gen(function* () {
      yield* messageRoomOrderService.persistMessageRoomOrder(sentMessage.id, {
        data: {
          previousFills: generated.previousFills,
          fills: generated.fills,
          hour: generated.hour,
          rank: generated.rank,
          monitor: generated.monitor,
          guildId,
          messageChannelId: sentMessage.channel_id,
          createdByUserId,
        },
        entries: generated.entries,
      });
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logError("Failed to persist tentative room order").pipe(
          Effect.annotateLogs({
            guildId,
            runningChannelId,
            hour,
            messageId: sentMessage.id,
          }),
          Effect.andThen(Effect.logError(cause)),
          Effect.andThen(
            botClient
              .updateMessage(sentMessage.channel_id, sentMessage.id, {
                components: [tentativeRoomOrderPinActionRow()],
              })
              .pipe(
                Effect.catchCause((updateCause) =>
                  Effect.logError(
                    "Failed to persist tentative room order and downgrade buttons",
                  ).pipe(
                    Effect.annotateLogs({
                      guildId,
                      runningChannelId,
                      hour,
                      messageId: sentMessage.id,
                    }),
                    Effect.andThen(Effect.logError(cause)),
                    Effect.andThen(Effect.logError(updateCause)),
                  ),
                ),
              ),
          ),
        ),
      ),
    );

    return {
      messageId: sentMessage.id,
      messageChannelId: sentMessage.channel_id,
    };
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logError("Failed to send tentative room order").pipe(
        Effect.annotateLogs({
          guildId,
          runningChannelId,
          hour,
        }),
        Effect.andThen(Effect.logError(cause)),
        Effect.as(null),
      ),
    ),
  );
});

export class DispatchService extends Context.Service<DispatchService>()("DispatchService", {
  make: Effect.gen(function* () {
    const botClient = yield* IngressBotClient;
    const checkinService = yield* CheckinService;
    const messageCheckinService = yield* MessageCheckinService;
    const messageRoomOrderService = yield* MessageRoomOrderService;
    const roomOrderService = yield* RoomOrderService;

    return {
      checkin: Effect.fn("DispatchService.checkin")(function* (payload: CheckinDispatchPayload) {
        const user = yield* SheetAuthUser;
        const createdByUserId = user.userId;
        const generated = yield* checkinService.generate(payload);
        const messageSink = makeMessageSink(
          botClient,
          generated.runningChannelId,
          payload.interactionToken,
        );
        const primaryMessage = yield* messageSink.sendPrimary(
          typeof payload.interactionToken === "string"
            ? {
                content: "Dispatching check-in...",
                flags: MessageFlags.Ephemeral,
              }
            : {
                content: generated.monitorCheckinMessage,
              },
        );

        let checkinMessage: DiscordMessage | null = null;
        let tentativeRoomOrderMessage: {
          readonly messageId: string;
          readonly messageChannelId: string;
        } | null = null;

        if (generated.initialMessage !== null) {
          checkinMessage = yield* botClient.sendMessage(generated.checkinChannelId, {
            content: generated.initialMessage,
          });

          yield* messageCheckinService.persistMessageCheckin(checkinMessage.id, {
            data: {
              initialMessage: generated.initialMessage,
              hour: generated.hour,
              channelId: generated.runningChannelId,
              roleId: generated.roleId,
              guildId: payload.guildId,
              messageChannelId: generated.checkinChannelId,
              createdByUserId,
            },
            memberIds: generated.fillIds,
          });

          yield* botClient
            .updateMessage(checkinMessage.channel_id, checkinMessage.id, {
              components: [checkinActionRow()],
            })
            .pipe(
              Effect.catch(
                logEnableFailure(
                  "Failed to enable check-in message after persistence; leaving message without components",
                ),
              ),
            );

          tentativeRoomOrderMessage = yield* sendTentativeRoomOrder({
            guildId: payload.guildId,
            runningChannelId: generated.runningChannelId,
            hour: generated.hour,
            fillCount: generated.fillCount,
            createdByUserId,
            botClient,
            roomOrderService,
            messageRoomOrderService,
          });
        }

        const finalPrimaryMessage =
          typeof payload.interactionToken === "string"
            ? checkinMessage === null
              ? yield* messageSink.updatePrimary(primaryMessage, {
                  content: generated.monitorCheckinMessage,
                  flags: MessageFlags.Ephemeral,
                })
              : yield* messageSink
                  .updatePrimary(primaryMessage, {
                    content: generated.monitorCheckinMessage,
                    flags: MessageFlags.Ephemeral,
                  })
                  .pipe(
                    Effect.catch((error) =>
                      logEnableFailure(
                        "Failed to update check-in primary response after persistence; leaving progress message",
                      )(error).pipe(Effect.as(primaryMessage)),
                    ),
                  )
            : primaryMessage;

        return {
          hour: generated.hour,
          runningChannelId: generated.runningChannelId,
          checkinChannelId: generated.checkinChannelId,
          checkinMessageId: checkinMessage?.id ?? null,
          checkinMessageChannelId: checkinMessage?.channel_id ?? null,
          primaryMessageId: finalPrimaryMessage.id,
          primaryMessageChannelId: finalPrimaryMessage.channel_id,
          tentativeRoomOrderMessageId: tentativeRoomOrderMessage?.messageId ?? null,
          tentativeRoomOrderMessageChannelId: tentativeRoomOrderMessage?.messageChannelId ?? null,
        } satisfies CheckinDispatchResult;
      }),
      roomOrder: Effect.fn("DispatchService.roomOrder")(function* (
        payload: RoomOrderDispatchPayload,
      ) {
        const user = yield* SheetAuthUser;
        const createdByUserId = user.userId;
        const generated = yield* roomOrderService.generate(payload);
        const messageSink = makeMessageSink(
          botClient,
          generated.runningChannelId,
          payload.interactionToken,
        );
        const message = yield* messageSink.sendPrimary({
          content: generated.content,
          components: [roomOrderActionRow(generated.range, generated.rank, true)],
        });

        yield* messageRoomOrderService.persistMessageRoomOrder(message.id, {
          data: {
            previousFills: generated.previousFills,
            fills: generated.fills,
            hour: generated.hour,
            rank: generated.rank,
            monitor: generated.monitor,
            guildId: payload.guildId,
            messageChannelId: message.channel_id,
            createdByUserId,
          },
          entries: generated.entries,
        });

        const enabledMessage = yield* messageSink
          .updatePrimary(message, {
            components: [roomOrderActionRow(generated.range, generated.rank)],
          })
          .pipe(
            Effect.catch((error) =>
              logEnableFailure(
                "Failed to enable room-order message after persistence; leaving disabled components",
              )(error).pipe(Effect.as(message)),
            ),
          );

        return {
          messageId: enabledMessage.id,
          messageChannelId: enabledMessage.channel_id,
          hour: generated.hour,
          runningChannelId: generated.runningChannelId,
          rank: generated.rank,
        } satisfies RoomOrderDispatchResult;
      }),
    };
  }),
}) {
  static layer = Layer.effect(DispatchService, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        IngressBotClient.layer,
        CheckinService.layer,
        MessageCheckinService.layer,
        MessageRoomOrderService.layer,
        RoomOrderService.layer,
      ),
    ),
  );
}
