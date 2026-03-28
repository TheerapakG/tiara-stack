import { HttpApiBuilder } from "@effect/platform";
import { MembersApiCacheView, RolesApiCacheView } from "dfx-discord-utils/discord/cache";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { getModernMessageGuildId } from "@/handlers/message/shared";
import { catchParseErrorAsValidationError } from "typhoon-core/error";
import { provideCurrentGuildUser, requireMonitorGuild } from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { MessageRoomOrder } from "@/schemas/messageRoomOrder";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { GuildConfigService } from "@/services/guildConfig";
import { MessageRoomOrderService } from "@/services/messageRoomOrder";

const missingMessageRoomOrderError = () =>
  makeArgumentError("Cannot get message room order, the message might not be registered");

export const LEGACY_MESSAGE_ROOM_ORDER_ACCESS_ERROR =
  "Legacy message room order records are no longer accessible";

export const denyLegacyMessageRoomOrderAccess = () =>
  Effect.fail(new Unauthorized({ message: LEGACY_MESSAGE_ROOM_ORDER_ACCESS_ERROR }));

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

export const requireRoomOrderMonitorAccess = (
  record: MessageRoomOrder,
): Effect.Effect<
  void,
  Unauthorized,
  MembersApiCacheView | RolesApiCacheView | GuildConfigService | SheetAuthUser
> =>
  Option.match(getModernMessageGuildId(record), {
    onSome: (guildId) => provideCurrentGuildUser(guildId, requireMonitorGuild(guildId)),
    onNone: denyLegacyMessageRoomOrderAccess,
  });

export const requireRoomOrderUpsertAccess = (
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
            : denyLegacyMessageRoomOrderAccess(),
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
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, urlParams.messageId)
            .pipe(
              Effect.flatMap((record) =>
                requireRoomOrderMonitorAccess(record).pipe(Effect.andThen(Effect.succeed(record))),
              ),
            )
            .pipe(catchParseErrorAsValidationError),
        )
        .handle("upsertMessageRoomOrder", ({ payload }) =>
          requireRoomOrderUpsertAccess(
            messageRoomOrderService,
            payload.messageId,
            typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
          )
            .pipe(
              Effect.andThen(
                messageRoomOrderService.upsertMessageRoomOrder(payload.messageId, payload.data),
              ),
            )
            .pipe(catchParseErrorAsValidationError),
        )
        .handle("decrementMessageRoomOrderRank", ({ payload }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId)
            .pipe(
              Effect.flatMap((record) =>
                requireRoomOrderMonitorAccess(record).pipe(
                  Effect.andThen(
                    messageRoomOrderService.decrementMessageRoomOrderRank(payload.messageId),
                  ),
                ),
              ),
            )
            .pipe(catchParseErrorAsValidationError),
        )
        .handle("incrementMessageRoomOrderRank", ({ payload }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId)
            .pipe(
              Effect.flatMap((record) =>
                requireRoomOrderMonitorAccess(record).pipe(
                  Effect.andThen(
                    messageRoomOrderService.incrementMessageRoomOrderRank(payload.messageId),
                  ),
                ),
              ),
            )
            .pipe(catchParseErrorAsValidationError),
        )
        .handle("getMessageRoomOrderEntry", ({ urlParams }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, urlParams.messageId)
            .pipe(
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
            )
            .pipe(catchParseErrorAsValidationError),
        )
        .handle("getMessageRoomOrderRange", ({ urlParams }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, urlParams.messageId)
            .pipe(
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
            )
            .pipe(catchParseErrorAsValidationError),
        )
        .handle("upsertMessageRoomOrderEntry", ({ payload }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId)
            .pipe(
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
            )
            .pipe(catchParseErrorAsValidationError),
        )
        .handle("removeMessageRoomOrderEntry", ({ payload }) =>
          getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId)
            .pipe(
              Effect.flatMap((record) =>
                requireRoomOrderMonitorAccess(record).pipe(
                  Effect.andThen(
                    messageRoomOrderService.removeMessageRoomOrderEntry(payload.messageId),
                  ),
                ),
              ),
            )
            .pipe(catchParseErrorAsValidationError),
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
