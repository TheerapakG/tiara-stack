import { Effect, Layer, Option } from "effect";
import { hasTentativeRoomOrderPrefix } from "sheet-ingress-api/discordComponents";
import { RoomOrderButtonMethods, RoomOrderRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import type {
  RoomOrderButtonBasePayload,
  RoomOrderButtonResult,
} from "sheet-ingress-api/sheet-apis-rpc";
import type { MessageRoomOrder } from "sheet-ingress-api/schemas/messageRoomOrder";
import { makeArgumentError } from "typhoon-core/error";
import { requireRoomOrderMonitorAccess } from "@/handlers/messageRoomOrder/http";
import { normalizeDispatchError } from "@/handlers/shared/dispatchError";
import { withCurrentGuildAuthFromPayload } from "@/handlers/shared/guildAuthorization";
import {
  AuthorizationService,
  DispatchService,
  MessageRoomOrderService,
  RoomOrderService,
} from "@/services";

type RoomOrderRankButtonHandler = (
  payload: RoomOrderButtonBasePayload,
  authorizedRoomOrder: MessageRoomOrder,
) => Effect.Effect<RoomOrderButtonResult, unknown, unknown>;

export const roomOrderLayer = RoomOrderRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const dispatchService = yield* DispatchService;
    const messageRoomOrderService = yield* MessageRoomOrderService;
    const roomOrderService = yield* RoomOrderService;
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
      "roomOrder.generate": withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* roomOrderService.generate(payload);
        }),
      ),
      "roomOrder.dispatch": withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
          // withPayloadGuildAuth provides guild-scoped auth context; this enforces monitor access.
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* dispatchService
            .roomOrder(payload)
            .pipe(Effect.mapError(normalizeDispatchError("Failed to dispatch room order")));
        }),
      ),
      [RoomOrderButtonMethods.previous.rpcTag]: handleRoomOrderRankButton((payload, record) =>
        dispatchService.roomOrderPreviousButton(payload, record),
      ),
      [RoomOrderButtonMethods.next.rpcTag]: handleRoomOrderRankButton((payload, record) =>
        dispatchService.roomOrderNextButton(payload, record),
      ),
      [RoomOrderButtonMethods.send.rpcTag]: Effect.fnUntraced(function* ({ payload }) {
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
      [RoomOrderButtonMethods.pinTentative.rpcTag]: Effect.fnUntraced(function* ({ payload }) {
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
    MessageRoomOrderService.layer,
    RoomOrderService.layer,
  ]),
);
