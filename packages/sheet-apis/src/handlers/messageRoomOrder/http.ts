import { HttpApiBuilder } from "effect/unstable/httpapi";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option } from "effect";
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

const getRequiredMessageRoomOrderRecord = Effect.fn(
  "messageRoomOrder.getRequiredMessageRoomOrderRecord",
)(function* (messageRoomOrderService: MessageRoomOrderAccessService, messageId: string) {
  const record = yield* messageRoomOrderService.getMessageRoomOrder(messageId);

  if (Option.isNone(record)) {
    return yield* Effect.fail(missingMessageRoomOrderError());
  }

  return record.value;
});

export const requireRoomOrderMonitorAccess = Effect.fn(
  "messageRoomOrder.requireRoomOrderMonitorAccess",
)(function* (authorizationService: typeof AuthorizationService.Service, record: MessageRoomOrder) {
  const guildId = Option.getOrElse(getModernMessageGuildId(record), () => null);

  if (guildId === null) {
    return yield* denyLegacyMessageRoomOrderAccess();
  }

  return yield* authorizationService.provideCurrentGuildUser(
    guildId,
    authorizationService.requireMonitorGuild(guildId),
  );
});

export const requireRoomOrderUpsertAccess = Effect.fn(
  "messageRoomOrder.requireRoomOrderUpsertAccess",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  messageRoomOrderService: MessageRoomOrderAccessService,
  messageId: string,
  guildId?: string,
) {
  const existingRecord = yield* messageRoomOrderService.getMessageRoomOrder(messageId);

  if (Option.isNone(existingRecord)) {
    if (typeof guildId === "string") {
      return yield* authorizationService.provideCurrentGuildUser(
        guildId,
        authorizationService.requireMonitorGuild(guildId),
      );
    }

    return yield* denyLegacyMessageRoomOrderAccess();
  }

  return yield* requireRoomOrderMonitorAccess(authorizationService, existingRecord.value);
});

export const messageRoomOrderLayer = HttpApiBuilder.group(
  Api,
  "messageRoomOrder",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const messageRoomOrderService = yield* MessageRoomOrderService;

    return handlers
      .handle("getMessageRoomOrder", ({ query }) =>
        Effect.gen(function* () {
          const record = yield* getRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            query.messageId,
          );
          yield* requireRoomOrderMonitorAccess(authorizationService, record);
          return record;
        }),
      )
      .handle("upsertMessageRoomOrder", ({ payload }) =>
        Effect.gen(function* () {
          yield* requireRoomOrderUpsertAccess(
            authorizationService,
            messageRoomOrderService,
            payload.messageId,
            typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
          );

          return yield* messageRoomOrderService.upsertMessageRoomOrder(
            payload.messageId,
            payload.data,
          );
        }),
      )
      .handle("decrementMessageRoomOrderRank", ({ payload }) =>
        Effect.gen(function* () {
          const record = yield* getRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            payload.messageId,
          );
          yield* requireRoomOrderMonitorAccess(authorizationService, record);
          return yield* messageRoomOrderService.decrementMessageRoomOrderRank(payload.messageId);
        }),
      )
      .handle("incrementMessageRoomOrderRank", ({ payload }) =>
        Effect.gen(function* () {
          const record = yield* getRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            payload.messageId,
          );
          yield* requireRoomOrderMonitorAccess(authorizationService, record);
          return yield* messageRoomOrderService.incrementMessageRoomOrderRank(payload.messageId);
        }),
      )
      .handle("getMessageRoomOrderEntry", ({ query }) =>
        Effect.gen(function* () {
          const record = yield* getRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            query.messageId,
          );
          yield* requireRoomOrderMonitorAccess(authorizationService, record);
          return yield* messageRoomOrderService.getMessageRoomOrderEntry(
            query.messageId,
            Number(query.rank),
          );
        }),
      )
      .handle("getMessageRoomOrderRange", ({ query }) =>
        Effect.gen(function* () {
          const record = yield* getRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            query.messageId,
          );
          yield* requireRoomOrderMonitorAccess(authorizationService, record);

          const range = yield* messageRoomOrderService.getMessageRoomOrderRange(query.messageId);
          if (Option.isNone(range)) {
            return yield* Effect.fail(
              makeArgumentError(
                "Cannot get message room order range, the message might not be registered",
              ),
            );
          }

          return range.value;
        }),
      )
      .handle("upsertMessageRoomOrderEntry", ({ payload }) =>
        Effect.gen(function* () {
          const record = yield* getRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            payload.messageId,
          );
          yield* requireRoomOrderMonitorAccess(authorizationService, record);
          return yield* messageRoomOrderService.upsertMessageRoomOrderEntry(
            payload.messageId,
            payload.entries,
          );
        }),
      )
      .handle("removeMessageRoomOrderEntry", ({ payload }) =>
        Effect.gen(function* () {
          const record = yield* getRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            payload.messageId,
          );
          yield* requireRoomOrderMonitorAccess(authorizationService, record);
          return yield* messageRoomOrderService.removeMessageRoomOrderEntry(payload.messageId);
        }),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    MessageRoomOrderService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
