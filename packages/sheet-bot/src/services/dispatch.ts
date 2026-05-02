import { Discord, DiscordREST } from "dfx";
import { MessageFlags } from "discord-api-types/v10";
import { Context, Effect, HashSet, Layer } from "effect";
import { DiscordApplication } from "dfx-discord-utils/discord";
import { makeUnknownError, Unauthorized } from "typhoon-core/error";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import type { Permission } from "sheet-ingress-api/schemas/permissions";
import type {
  DispatchCheckinPayload,
  DispatchCheckinResult,
  DispatchRoomOrderPayload,
  DispatchRoomOrderResult,
} from "sheet-ingress-api/sheet-bot-rpc";
import { discordApplicationLayer } from "../discord/application";
import { discordGatewayLayer } from "../discord/gateway";
import { checkinActionRow } from "../messageComponents/buttons/checkin";
import { roomOrderActionRow } from "../messageComponents/buttons/roomOrderComponents";
import { CheckinService } from "./checkin";
import { MessageCheckinService } from "./messageCheckin";
import { MessageRoomOrderService } from "./messageRoomOrder";
import { RoomOrderService } from "./roomOrder";
import { sendTentativeRoomOrder } from "./tentativeRoomOrder";

type MessagePayload = Discord.MessageCreateRequest | Discord.IncomingWebhookUpdateRequestPartial;

type DispatchMessageSink = {
  readonly sendPrimary: (payload: MessagePayload) => Effect.Effect<Discord.APIMessage, unknown>;
  readonly updatePrimary: (
    message: Discord.APIMessage,
    payload: Discord.IncomingWebhookUpdateRequestPartial,
  ) => Effect.Effect<Discord.APIMessage, unknown>;
};

const mapDiscordError = (message: string) => (cause: unknown) => makeUnknownError(message, cause);

const logEnableFailure = (message: string) => (error: unknown) =>
  Effect.logWarning(message).pipe(Effect.annotateLogs({ cause: String(error) }));

const hasPermission = (permissions: HashSet.HashSet<Permission>, permission: Permission) =>
  HashSet.has(permissions, permission);

const requireDispatchMonitorGuild = Effect.fn("DispatchService.requireDispatchMonitorGuild")(
  function* (guildId: string) {
    const user = yield* SheetAuthUser;
    if (
      hasPermission(user.permissions, "service") ||
      hasPermission(user.permissions, "app_owner") ||
      hasPermission(user.permissions, `monitor_guild:${guildId}`)
    ) {
      return user;
    }

    return yield* Effect.fail(
      new Unauthorized({ message: "User does not have monitor guild permission" }),
    );
  },
);

const makeInteractionMessageSink = (
  discordRest: Context.Service.Shape<typeof DiscordREST>,
  application: Context.Service.Shape<typeof DiscordApplication>,
  interactionToken: string,
): DispatchMessageSink => ({
  sendPrimary: (payload) =>
    discordRest
      .updateOriginalWebhookMessage(application.id, interactionToken, { payload })
      .pipe(Effect.mapError(mapDiscordError("Failed to edit deferred interaction response"))),
  updatePrimary: (_message, payload) =>
    discordRest
      .updateOriginalWebhookMessage(application.id, interactionToken, { payload })
      .pipe(Effect.mapError(mapDiscordError("Failed to update deferred interaction response"))),
});

const makeChannelMessageSink = (
  discordRest: Context.Service.Shape<typeof DiscordREST>,
  channelId: string,
): DispatchMessageSink => ({
  sendPrimary: (payload) =>
    discordRest
      .createMessage(channelId, payload as Discord.MessageCreateRequest)
      .pipe(Effect.mapError(mapDiscordError("Failed to send primary dispatch message"))),
  updatePrimary: (message, payload) =>
    discordRest
      .updateMessage(message.channel_id, message.id, payload as Discord.MessageEditRequestPartial)
      .pipe(Effect.mapError(mapDiscordError("Failed to update primary dispatch message"))),
});

const makeMessageSink = (
  discordRest: Context.Service.Shape<typeof DiscordREST>,
  application: Context.Service.Shape<typeof DiscordApplication>,
  channelId: string,
  interactionToken: string | undefined,
): DispatchMessageSink => {
  if (typeof interactionToken === "string") {
    return makeInteractionMessageSink(discordRest, application, interactionToken);
  }
  return makeChannelMessageSink(discordRest, channelId);
};

export class DispatchService extends Context.Service<DispatchService>()("DispatchService", {
  make: Effect.gen(function* () {
    const checkinService = yield* CheckinService;
    const messageCheckinService = yield* MessageCheckinService;
    const messageRoomOrderService = yield* MessageRoomOrderService;
    const roomOrderService = yield* RoomOrderService;
    const discordRest = yield* DiscordREST;
    const application = yield* DiscordApplication;

    return {
      checkin: Effect.fn("DispatchService.checkin")(function* (payload: DispatchCheckinPayload) {
        const user = yield* requireDispatchMonitorGuild(payload.guildId);
        const generated = yield* checkinService.generate({
          guildId: payload.guildId,
          channelName: payload.channelName,
          hour: payload.hour,
          template: payload.template,
        });
        const messageSink = makeMessageSink(
          discordRest,
          application,
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

        let checkinMessage: Discord.APIMessage | null = null;
        let tentativeRoomOrderMessage: {
          readonly messageId: string;
          readonly messageChannelId: string;
        } | null = null;

        if (generated.initialMessage !== null) {
          checkinMessage = yield* discordRest
            .createMessage(generated.checkinChannelId, {
              content: generated.initialMessage,
            })
            .pipe(Effect.mapError(mapDiscordError("Failed to send check-in message")));

          yield* messageCheckinService.persistMessageCheckin(checkinMessage.id, {
            data: {
              initialMessage: generated.initialMessage,
              hour: generated.hour,
              channelId: generated.runningChannelId,
              roleId: generated.roleId,
              guildId: payload.guildId,
              messageChannelId: generated.checkinChannelId,
              createdByUserId: user.userId,
            },
            memberIds: generated.fillIds,
          });

          yield* discordRest
            .updateMessage(checkinMessage.channel_id, checkinMessage.id, {
              components: [checkinActionRow().toJSON()],
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
            roomOrderService,
            messageRoomOrderService,
            sender: discordRest,
            createdByUserId: user.userId,
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
        } satisfies DispatchCheckinResult;
      }),
      roomOrder: Effect.fn("DispatchService.roomOrder")(function* (
        payload: DispatchRoomOrderPayload,
      ) {
        const user = yield* requireDispatchMonitorGuild(payload.guildId);
        const generated = yield* roomOrderService.generate({
          guildId: payload.guildId,
          channelName: payload.channelName,
          hour: payload.hour,
          healNeeded: payload.healNeeded,
        });
        const messageSink = makeMessageSink(
          discordRest,
          application,
          generated.runningChannelId,
          payload.interactionToken,
        );
        const message = yield* messageSink.sendPrimary({
          content: generated.content,
          components: [roomOrderActionRow(generated.range, generated.rank, true).toJSON()],
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
            createdByUserId: user.userId,
          },
          entries: generated.entries,
        });

        const enabledMessage = yield* messageSink
          .updatePrimary(message, {
            components: [roomOrderActionRow(generated.range, generated.rank).toJSON()],
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
        } satisfies DispatchRoomOrderResult;
      }),
    };
  }),
}) {
  static layer = Layer.effect(DispatchService, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        discordGatewayLayer,
        discordApplicationLayer,
        CheckinService.layer,
        MessageCheckinService.layer,
        MessageRoomOrderService.layer,
        RoomOrderService.layer,
      ),
    ),
  );
}
