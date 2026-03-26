import { HttpApiBuilder } from "@effect/platform";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import {
  provideCurrentGuildUser,
  requireBot,
  requireMonitorGuild,
} from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { MessageRoomOrder } from "@/schemas/messageRoomOrder";
import { GuildConfigService } from "@/services/guildConfig";
import { MessageRoomOrderService } from "@/services/messageRoomOrder";

const missingMessageRoomOrderError = () =>
  makeArgumentError("Cannot get message room order, the message might not be registered");

const getRequiredMessageRoomOrderRecord = (
  messageRoomOrderService: MessageRoomOrderService,
  messageId: string,
) =>
  messageRoomOrderService.getMessageRoomOrder(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onSome: Effect.succeed,
        onNone: () => Effect.fail(missingMessageRoomOrderError()),
      }),
    ),
  );

const requireRoomOrderMonitorAccess = (record: MessageRoomOrder) =>
  Option.isSome(record.guildId) && Option.isSome(record.messageChannelId)
    ? provideCurrentGuildUser(record.guildId.value, requireMonitorGuild(record.guildId.value))
    : requireBot("Legacy message room order records are restricted to the bot");

const requireRoomOrderUpsertAccess = (
  messageRoomOrderService: MessageRoomOrderService,
  messageId: string,
  guildId?: string,
) =>
  messageRoomOrderService.getMessageRoomOrder(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          typeof guildId === "string"
            ? provideCurrentGuildUser(guildId, requireMonitorGuild(guildId))
            : requireBot("Legacy message room order records are restricted to the bot"),
        onSome: requireRoomOrderMonitorAccess,
      }),
    ),
  );

export const MessageRoomOrderLive = HttpApiBuilder.group(Api, "messageRoomOrder", (handlers) =>
  pipe(
    Effect.all({
      messageRoomOrderService: MessageRoomOrderService,
    }),
    Effect.map(({ messageRoomOrderService }) =>
      handlers
        .handle("getMessageRoomOrder", ({ urlParams }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, urlParams.messageId).pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(record).pipe(Effect.andThen(Effect.succeed(record))),
            ),
          ),
        )
        .handle("upsertMessageRoomOrder", ({ payload }) =>
          requireRoomOrderUpsertAccess(
            messageRoomOrderService,
            payload.messageId,
            typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
          ).pipe(
            Effect.andThen(
              messageRoomOrderService.upsertMessageRoomOrder(payload.messageId, payload.data),
            ),
          ),
        )
        .handle("decrementMessageRoomOrderRank", ({ payload }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId).pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(record).pipe(
                Effect.andThen(
                  messageRoomOrderService.decrementMessageRoomOrderRank(payload.messageId),
                ),
              ),
            ),
          ),
        )
        .handle("incrementMessageRoomOrderRank", ({ payload }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId).pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(record).pipe(
                Effect.andThen(
                  messageRoomOrderService.incrementMessageRoomOrderRank(payload.messageId),
                ),
              ),
            ),
          ),
        )
        .handle("getMessageRoomOrderEntry", ({ urlParams }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, urlParams.messageId).pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(record).pipe(
                Effect.andThen(
                  messageRoomOrderService.getMessageRoomOrderEntry(
                    urlParams.messageId,
                    Number(urlParams.rank),
                  ),
                ),
              ),
            ),
          ),
        )
        .handle("getMessageRoomOrderRange", ({ urlParams }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, urlParams.messageId).pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(record).pipe(
                Effect.andThen(
                  pipe(
                    messageRoomOrderService.getMessageRoomOrderRange(urlParams.messageId),
                    Effect.flatMap(
                      Option.match({
                        onSome: (range) => Effect.succeed(range),
                        onNone: () =>
                          Effect.fail(
                            makeArgumentError(
                              "Cannot get message room order range, the message might not be registered",
                            ),
                          ),
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        )
        .handle("upsertMessageRoomOrderEntry", ({ payload }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId).pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(record).pipe(
                Effect.andThen(
                  messageRoomOrderService.upsertMessageRoomOrderEntry(
                    payload.messageId,
                    payload.entries,
                  ),
                ),
              ),
            ),
          ),
        )
        .handle("removeMessageRoomOrderEntry", ({ payload }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId).pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(record).pipe(
                Effect.andThen(
                  messageRoomOrderService.removeMessageRoomOrderEntry(payload.messageId),
                ),
              ),
            ),
          ),
        ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      MessageRoomOrderService.Default,
      GuildConfigService.Default,
      SheetAuthTokenAuthorizationLive,
    ),
  ),
);
