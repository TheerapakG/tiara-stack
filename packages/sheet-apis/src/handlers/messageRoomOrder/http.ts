import { HttpApiBuilder } from "effect/unstable/httpapi";
import { catchSchemaErrorAsValidationError, makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { getModernMessageGuildId } from "@/handlers/message/shared";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { MessageRoomOrder } from "@/schemas/messageRoomOrder";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { AuthorizationService, MessageRoomOrderService } from "@/services";

const missingMessageRoomOrderError = () =>
  makeArgumentError("Cannot get message room order, the message might not be registered");

export const LEGACY_MESSAGE_ROOM_ORDER_ACCESS_ERROR =
  "Legacy message room order records are no longer accessible";

export const denyLegacyMessageRoomOrderAccess = () =>
  Effect.fail(new Unauthorized({ message: LEGACY_MESSAGE_ROOM_ORDER_ACCESS_ERROR }));

type MessageRoomOrderAccessService = Pick<
  typeof MessageRoomOrderService.Service,
  "getMessageRoomOrder"
>;

const getRequiredMessageRoomOrderRecord = (
  messageRoomOrderService: MessageRoomOrderAccessService,
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
  authorizationService: typeof AuthorizationService.Service,
  record: MessageRoomOrder,
) =>
  Effect.gen(function* () {
    const guildId = Option.getOrElse(getModernMessageGuildId(record), () => null);

    if (guildId === null) {
      return yield* denyLegacyMessageRoomOrderAccess();
    }

    return yield* authorizationService.provideCurrentGuildUser(
      guildId,
      authorizationService.requireMonitorGuild(guildId),
    );
  });

export const requireRoomOrderUpsertAccess = (
  authorizationService: typeof AuthorizationService.Service,
  messageRoomOrderService: MessageRoomOrderAccessService,
  messageId: string,
  guildId?: string,
) =>
  messageRoomOrderService.getMessageRoomOrder(messageId).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () =>
          typeof guildId === "string"
            ? authorizationService.provideCurrentGuildUser(
                guildId,
                authorizationService.requireMonitorGuild(guildId),
              )
            : denyLegacyMessageRoomOrderAccess(),
        onSome: (record) => requireRoomOrderMonitorAccess(authorizationService, record),
      }),
    ),
  );

export const messageRoomOrderLayer = HttpApiBuilder.group(
  Api,
  "messageRoomOrder",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const messageRoomOrderService = yield* MessageRoomOrderService;

    return handlers
      .handle("getMessageRoomOrder", ({ query }) =>
        getRequiredMessageRoomOrderRecord(messageRoomOrderService, query.messageId)
          .pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(authorizationService, record).pipe(
                Effect.andThen(Effect.succeed(record)),
              ),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("upsertMessageRoomOrder", ({ payload }) =>
        requireRoomOrderUpsertAccess(
          authorizationService,
          messageRoomOrderService,
          payload.messageId,
          typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
        )
          .pipe(
            Effect.andThen(
              messageRoomOrderService.upsertMessageRoomOrder(payload.messageId, payload.data),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("decrementMessageRoomOrderRank", ({ payload }) =>
        getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId)
          .pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(authorizationService, record).pipe(
                Effect.andThen(
                  messageRoomOrderService.decrementMessageRoomOrderRank(payload.messageId),
                ),
              ),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("incrementMessageRoomOrderRank", ({ payload }) =>
        getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId)
          .pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(authorizationService, record).pipe(
                Effect.andThen(
                  messageRoomOrderService.incrementMessageRoomOrderRank(payload.messageId),
                ),
              ),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getMessageRoomOrderEntry", ({ query }) =>
        getRequiredMessageRoomOrderRecord(messageRoomOrderService, query.messageId)
          .pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(authorizationService, record).pipe(
                Effect.andThen(
                  messageRoomOrderService.getMessageRoomOrderEntry(
                    query.messageId,
                    Number(query.rank),
                  ),
                ),
              ),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getMessageRoomOrderRange", ({ query }) =>
        getRequiredMessageRoomOrderRecord(messageRoomOrderService, query.messageId)
          .pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(authorizationService, record).pipe(
                Effect.andThen(
                  pipe(
                    messageRoomOrderService.getMessageRoomOrderRange(query.messageId),
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
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("upsertMessageRoomOrderEntry", ({ payload }) =>
        getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId)
          .pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(authorizationService, record).pipe(
                Effect.andThen(
                  messageRoomOrderService.upsertMessageRoomOrderEntry(
                    payload.messageId,
                    payload.entries,
                  ),
                ),
              ),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      )
      .handle("removeMessageRoomOrderEntry", ({ payload }) =>
        getRequiredMessageRoomOrderRecord(messageRoomOrderService, payload.messageId)
          .pipe(
            Effect.flatMap((record) =>
              requireRoomOrderMonitorAccess(authorizationService, record).pipe(
                Effect.andThen(
                  messageRoomOrderService.removeMessageRoomOrderEntry(payload.messageId),
                ),
              ),
            ),
          )
          .pipe(catchSchemaErrorAsValidationError),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    MessageRoomOrderService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
