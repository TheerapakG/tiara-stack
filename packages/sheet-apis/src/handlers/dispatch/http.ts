import { Effect, Layer, Option } from "effect";
import { hasTentativeRoomOrderPrefix } from "sheet-ingress-api/discordComponents";
import {
  DispatchRoomOrderButtonMethods,
  DispatchRpcs,
  type RoomOrderButtonBasePayload,
  type RoomOrderButtonResult,
} from "sheet-ingress-api/sheet-apis-rpc";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import type { MessageRoomOrder } from "sheet-ingress-api/schemas/messageRoomOrder";
import { makeArgumentError } from "typhoon-core/error";
import { requireMessageCheckinParticipantMutationAccess } from "@/handlers/messageCheckin/http";
import { requireRoomOrderMonitorAccess } from "@/handlers/messageRoomOrder/http";
import { normalizeDispatchError } from "@/handlers/shared/dispatchError";
import { withCurrentGuildAuthFromPayload } from "@/handlers/shared/guildAuthorization";
import {
  AuthorizationService,
  DispatchService,
  MessageCheckinService,
  MessageRoomOrderService,
} from "@/services";

type RoomOrderRankButtonHandler = (
  payload: RoomOrderButtonBasePayload,
  authorizedRoomOrder: MessageRoomOrder,
) => Effect.Effect<RoomOrderButtonResult, unknown, unknown>;

export const dispatchLayer = DispatchRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const dispatchService = yield* DispatchService;
    const messageCheckinService = yield* MessageCheckinService;
    const messageRoomOrderService = yield* MessageRoomOrderService;
    const withPayloadGuildAuth = withCurrentGuildAuthFromPayload(authorizationService);
    const handleRoomOrderRankButton = (handleButton: RoomOrderRankButtonHandler) =>
      Effect.fnUntraced(function* ({ payload }) {
        const record = yield* messageRoomOrderService
          .getMessageRoomOrder(payload.messageId)
          .pipe(Effect.mapError(normalizeDispatchError("Failed to authorize room-order button")));
        if (Option.isNone(record)) {
          return yield* Effect.fail(
            makeArgumentError("Cannot handle room-order button, message is not registered"),
          );
        }
        const requiresMonitorAccess =
          record.value.tentative || hasTentativeRoomOrderPrefix(payload.messageContent ?? "");

        if (requiresMonitorAccess) {
          yield* requireRoomOrderMonitorAccess(authorizationService, record.value).pipe(
            Effect.mapError(normalizeDispatchError("Failed to authorize room-order button")),
          );
        }

        return yield* handleButton(payload, record.value).pipe(
          Effect.mapError(normalizeDispatchError("Failed to handle room-order button")),
        );
      });

    return {
      "dispatch.checkin": withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* dispatchService
            .checkin(payload)
            .pipe(Effect.mapError(normalizeDispatchError("Failed to dispatch check-in")));
        }),
      ),
      "dispatch.checkinButton": Effect.fnUntraced(function* ({ payload }) {
        const user = yield* SheetAuthUser;
        yield* requireMessageCheckinParticipantMutationAccess(
          authorizationService,
          messageCheckinService,
          payload.messageId,
          user.accountId,
        ).pipe(Effect.mapError(normalizeDispatchError("Failed to authorize check-in button")));
        return yield* dispatchService
          .checkinButton(payload)
          .pipe(Effect.mapError(normalizeDispatchError("Failed to handle check-in button")));
      }),
      "dispatch.roomOrder": withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* dispatchService
            .roomOrder(payload)
            .pipe(Effect.mapError(normalizeDispatchError("Failed to dispatch room order")));
        }),
      ),
      [DispatchRoomOrderButtonMethods.previous.rpcTag]: handleRoomOrderRankButton(
        (payload, record) => dispatchService.roomOrderPreviousButton(payload, record),
      ),
      [DispatchRoomOrderButtonMethods.next.rpcTag]: handleRoomOrderRankButton((payload, record) =>
        dispatchService.roomOrderNextButton(payload, record),
      ),
      [DispatchRoomOrderButtonMethods.send.rpcTag]: Effect.fnUntraced(function* ({ payload }) {
        const record = yield* messageRoomOrderService
          .getMessageRoomOrder(payload.messageId)
          .pipe(Effect.mapError(normalizeDispatchError("Failed to authorize room-order button")));
        if (Option.isNone(record)) {
          return yield* Effect.fail(
            makeArgumentError("Cannot handle room-order button, message is not registered"),
          );
        }

        return yield* dispatchService
          .roomOrderSendButton(payload, record.value)
          .pipe(Effect.mapError(normalizeDispatchError("Failed to handle room-order button")));
      }),
      [DispatchRoomOrderButtonMethods.pinTentative.rpcTag]: Effect.fnUntraced(function* ({
        payload,
      }) {
        const record = yield* messageRoomOrderService
          .getMessageRoomOrder(payload.messageId)
          .pipe(Effect.mapError(normalizeDispatchError("Failed to authorize room-order button")));
        if (Option.isNone(record)) {
          return yield* withPayloadGuildAuth(
            Effect.fnUntraced(function* ({ payload }) {
              yield* authorizationService
                .requireMonitorGuild(payload.guildId)
                .pipe(
                  Effect.mapError(normalizeDispatchError("Failed to authorize room-order button")),
                );
              return yield* dispatchService
                .roomOrderPinTentativeButton(payload)
                .pipe(
                  Effect.mapError(normalizeDispatchError("Failed to handle room-order button")),
                );
            }),
          )({ payload });
        }

        yield* requireRoomOrderMonitorAccess(authorizationService, record.value).pipe(
          Effect.mapError(normalizeDispatchError("Failed to authorize room-order button")),
        );

        return yield* dispatchService
          .roomOrderPinTentativeButton(payload, record.value)
          .pipe(Effect.mapError(normalizeDispatchError("Failed to handle room-order button")));
      }),
    };
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    DispatchService.layer,
    MessageCheckinService.layer,
    MessageRoomOrderService.layer,
  ]),
);
