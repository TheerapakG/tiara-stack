import { makeArgumentError } from "typhoon-core/error";
import { Effect, Layer, Option } from "effect";
import {
  MESSAGE_ROOM_ORDER_NOT_REGISTERED_ERROR_MESSAGE,
  MessageRoomOrderRpcs,
} from "sheet-ingress-api/sheet-apis-rpc";
import { getModernMessageGuildId } from "@/handlers/message/shared";
import { SheetAuthGuildUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthGuildUser";
import { MessageRoomOrder } from "sheet-ingress-api/schemas/messageRoomOrder";
import { Unauthorized } from "typhoon-core/error";
import { AuthorizationService, MessageRoomOrderService } from "@/services";

const missingMessageRoomOrderError = () =>
  makeArgumentError(MESSAGE_ROOM_ORDER_NOT_REGISTERED_ERROR_MESSAGE);

export const LEGACY_MESSAGE_ROOM_ORDER_ACCESS_ERROR =
  "Legacy message room order records are no longer accessible";

const denyLegacyMessageRoomOrderAccess = () =>
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

export const messageRoomOrderLayer = MessageRoomOrderRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const messageRoomOrderService = yield* MessageRoomOrderService;

    return {
      "messageRoomOrder.getMessageRoomOrder": Effect.fnUntraced(function* ({ query }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          query.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return authContext.record;
      }),
      "messageRoomOrder.upsertMessageRoomOrder": Effect.fnUntraced(function* ({ payload }) {
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
      "messageRoomOrder.persistMessageRoomOrder": Effect.fnUntraced(function* ({ payload }) {
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
      "messageRoomOrder.decrementMessageRoomOrderRank": Effect.fnUntraced(function* ({ payload }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.decrementMessageRoomOrderRank(payload.messageId, {
          expectedRank: payload.expectedRank,
          tentativeUpdateClaimId: payload.tentativeUpdateClaimId,
        });
      }),
      "messageRoomOrder.incrementMessageRoomOrderRank": Effect.fnUntraced(function* ({ payload }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.incrementMessageRoomOrderRank(payload.messageId, {
          expectedRank: payload.expectedRank,
          tentativeUpdateClaimId: payload.tentativeUpdateClaimId,
        });
      }),
      "messageRoomOrder.getMessageRoomOrderEntry": Effect.fnUntraced(function* ({ query }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          query.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.getMessageRoomOrderEntry(query.messageId, query.rank);
      }),
      "messageRoomOrder.getMessageRoomOrderRange": Effect.fnUntraced(function* ({ query }) {
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
      "messageRoomOrder.upsertMessageRoomOrderEntry": Effect.fnUntraced(function* ({ payload }) {
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
      "messageRoomOrder.removeMessageRoomOrderEntry": Effect.fnUntraced(function* ({ payload }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.removeMessageRoomOrderEntry(payload.messageId);
      }),
      "messageRoomOrder.claimMessageRoomOrderSend": Effect.fnUntraced(function* ({ payload }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.claimMessageRoomOrderSend(
          payload.messageId,
          payload.claimId,
        );
      }),
      "messageRoomOrder.completeMessageRoomOrderSend": Effect.fnUntraced(function* ({ payload }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.completeMessageRoomOrderSend(
          payload.messageId,
          payload.claimId,
          payload.sentMessage,
        );
      }),
      "messageRoomOrder.releaseMessageRoomOrderSendClaim": Effect.fnUntraced(function* ({
        payload,
      }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.releaseMessageRoomOrderSendClaim(
          payload.messageId,
          payload.claimId,
        );
      }),
      "messageRoomOrder.claimMessageRoomOrderTentativeUpdate": Effect.fnUntraced(function* ({
        payload,
      }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.claimMessageRoomOrderTentativeUpdate(
          payload.messageId,
          payload.claimId,
        );
      }),
      "messageRoomOrder.releaseMessageRoomOrderTentativeUpdateClaim": Effect.fnUntraced(function* ({
        payload,
      }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.releaseMessageRoomOrderTentativeUpdateClaim(
          payload.messageId,
          payload.claimId,
        );
      }),
      "messageRoomOrder.claimMessageRoomOrderTentativePin": Effect.fnUntraced(function* ({
        payload,
      }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.claimMessageRoomOrderTentativePin(
          payload.messageId,
          payload.claimId,
        );
      }),
      "messageRoomOrder.completeMessageRoomOrderTentativePin": Effect.fnUntraced(function* ({
        payload,
      }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.completeMessageRoomOrderTentativePin(
          payload.messageId,
          payload.claimId,
        );
      }),
      "messageRoomOrder.releaseMessageRoomOrderTentativePinClaim": Effect.fnUntraced(function* ({
        payload,
      }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.releaseMessageRoomOrderTentativePinClaim(
          payload.messageId,
          payload.claimId,
        );
      }),
      "messageRoomOrder.markMessageRoomOrderTentative": Effect.fnUntraced(function* ({ payload }) {
        const record = yield* loadRequiredMessageRoomOrderRecord(
          messageRoomOrderService,
          payload.messageId,
        );
        const authContext = resolveMessageRoomOrderAuthContext(record);
        const guildId = yield* getRequiredMessageRoomOrderGuildId(authContext);
        const messageChannelId = yield* Option.match(record.messageChannelId, {
          onSome: Effect.succeed,
          onNone: () =>
            Effect.fail(
              makeArgumentError("Cannot mark tentative room order, message channel is missing"),
            ),
        });

        yield* requireMessageRoomOrderMonitorPermission(authorizationService, authContext);

        return yield* messageRoomOrderService.markMessageRoomOrderTentative(payload.messageId, {
          guildId,
          messageChannelId,
        });
      }),
    };
  }),
).pipe(Layer.provide([AuthorizationService.layer, MessageRoomOrderService.layer]));
