import { HttpApiBuilder } from "effect/unstable/httpapi";
import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option } from "effect";
import { Api } from "@/api";
import { getModernMessageGuildId } from "@/handlers/message/shared";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { SheetAuthGuildUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthGuildUser";
import { MessageRoomOrder } from "sheet-ingress-api/schemas/messageRoomOrder";
import { Unauthorized } from "sheet-ingress-api/schemas/middlewares/unauthorized";
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

type MessageRoomOrderAuthContext = {
  readonly record: MessageRoomOrder;
  readonly guildId: string | null;
  readonly isLegacy: boolean;
};

const loadRequiredMessageRoomOrderRecord = Effect.fn(
  "messageRoomOrder.loadRequiredMessageRoomOrderRecord",
)(function* (messageRoomOrderService: MessageRoomOrderAccessService, messageId: string) {
  const record = yield* messageRoomOrderService.getMessageRoomOrder(messageId);

  if (Option.isNone(record)) {
    return yield* Effect.fail(missingMessageRoomOrderError());
  }

  return record.value;
});

const resolveMessageRoomOrderAuthContext = (
  record: MessageRoomOrder,
): MessageRoomOrderAuthContext => {
  const guildId = Option.getOrElse(getModernMessageGuildId(record), () => null);

  return {
    record,
    guildId,
    isLegacy: guildId === null,
  };
};

const getRequiredMessageRoomOrderGuildId = Effect.fn(
  "messageRoomOrder.getRequiredMessageRoomOrderGuildId",
)(function* (authContext: MessageRoomOrderAuthContext) {
  if (authContext.isLegacy || authContext.guildId === null) {
    return yield* denyLegacyMessageRoomOrderAccess();
  }

  return authContext.guildId;
});

const resolveMessageRoomOrderUpsertGuildId = Effect.fn(
  "messageRoomOrder.resolveMessageRoomOrderUpsertGuildId",
)(function* (
  messageRoomOrderService: MessageRoomOrderAccessService,
  messageId: string,
  guildId?: string,
) {
  const existingRecord = yield* messageRoomOrderService.getMessageRoomOrder(messageId);

  if (Option.isNone(existingRecord)) {
    if (typeof guildId === "string") {
      return guildId;
    }

    return yield* denyLegacyMessageRoomOrderAccess();
  }

  return yield* getRequiredMessageRoomOrderGuildId(
    resolveMessageRoomOrderAuthContext(existingRecord.value),
  );
});

const withResolvedMessageRoomOrderGuildUser = <A, E, R>(
  authorizationService: typeof AuthorizationService.Service,
  authContext: MessageRoomOrderAuthContext,
  effect: Effect.Effect<A, E, R>,
) =>
  (authContext.guildId === null
    ? effect
    : authorizationService.provideCurrentGuildUser(authContext.guildId, effect)) as Effect.Effect<
    A,
    E,
    Exclude<R, SheetAuthGuildUser>
  >;

const requireMessageRoomOrderMonitorPermission = Effect.fn(
  "messageRoomOrder.requireMessageRoomOrderMonitorPermission",
)(function* (
  authorizationService: typeof AuthorizationService.Service,
  authContext: MessageRoomOrderAuthContext,
) {
  const guildId = yield* getRequiredMessageRoomOrderGuildId(authContext);

  return yield* withResolvedMessageRoomOrderGuildUser(
    authorizationService,
    authContext,
    authorizationService.requireMonitorGuild(guildId),
  );
});

export const requireRoomOrderMonitorAccess = Effect.fn(
  "messageRoomOrder.requireRoomOrderMonitorAccess",
)(function* (authorizationService: typeof AuthorizationService.Service, record: MessageRoomOrder) {
  return yield* requireMessageRoomOrderMonitorPermission(
    authorizationService,
    resolveMessageRoomOrderAuthContext(record),
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
  const resolvedGuildId = yield* resolveMessageRoomOrderUpsertGuildId(
    messageRoomOrderService,
    messageId,
    guildId,
  );

  return yield* authorizationService.provideCurrentGuildUser(
    resolvedGuildId,
    authorizationService.requireMonitorGuild(resolvedGuildId),
  );
});

export const messageRoomOrderLayer = HttpApiBuilder.group(
  Api,
  "messageRoomOrder",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const messageRoomOrderService = yield* MessageRoomOrderService;

    return handlers
      .handle(
        "getMessageRoomOrder",
        Effect.fnUntraced(function* ({ query }) {
          const record = yield* loadRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            query.messageId,
          );
          const authContext = resolveMessageRoomOrderAuthContext(record);

          yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

          return authContext.record;
        }),
      )
      .handle(
        "upsertMessageRoomOrder",
        Effect.fnUntraced(function* ({ payload }) {
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
      .handle(
        "persistMessageRoomOrder",
        Effect.fnUntraced(function* ({ payload }) {
          yield* requireRoomOrderUpsertAccess(
            authorizationService,
            messageRoomOrderService,
            payload.messageId,
            typeof payload.data.guildId === "string" ? payload.data.guildId : undefined,
          );

          return yield* messageRoomOrderService.persistMessageRoomOrder(payload.messageId, {
            data: payload.data,
            entries: payload.entries,
          });
        }),
      )
      .handle(
        "decrementMessageRoomOrderRank",
        Effect.fnUntraced(function* ({ payload }) {
          const record = yield* loadRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            payload.messageId,
          );
          const authContext = resolveMessageRoomOrderAuthContext(record);

          yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

          return yield* messageRoomOrderService.decrementMessageRoomOrderRank(payload.messageId);
        }),
      )
      .handle(
        "incrementMessageRoomOrderRank",
        Effect.fnUntraced(function* ({ payload }) {
          const record = yield* loadRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            payload.messageId,
          );
          const authContext = resolveMessageRoomOrderAuthContext(record);

          yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

          return yield* messageRoomOrderService.incrementMessageRoomOrderRank(payload.messageId);
        }),
      )
      .handle(
        "getMessageRoomOrderEntry",
        Effect.fnUntraced(function* ({ query }) {
          const record = yield* loadRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            query.messageId,
          );
          const authContext = resolveMessageRoomOrderAuthContext(record);

          yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

          return yield* messageRoomOrderService.getMessageRoomOrderEntry(
            query.messageId,
            Number(query.rank),
          );
        }),
      )
      .handle(
        "getMessageRoomOrderRange",
        Effect.fnUntraced(function* ({ query }) {
          const record = yield* loadRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            query.messageId,
          );
          const authContext = resolveMessageRoomOrderAuthContext(record);

          yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

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
      .handle(
        "upsertMessageRoomOrderEntry",
        Effect.fnUntraced(function* ({ payload }) {
          const record = yield* loadRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            payload.messageId,
          );
          const authContext = resolveMessageRoomOrderAuthContext(record);

          yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

          return yield* messageRoomOrderService.upsertMessageRoomOrderEntry(
            payload.messageId,
            payload.entries,
          );
        }),
      )
      .handle(
        "removeMessageRoomOrderEntry",
        Effect.fnUntraced(function* ({ payload }) {
          const record = yield* loadRequiredMessageRoomOrderRecord(
            messageRoomOrderService,
            payload.messageId,
          );
          const authContext = resolveMessageRoomOrderAuthContext(record);

          yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

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
