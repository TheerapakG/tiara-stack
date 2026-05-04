import { Effect, Layer, Option } from "effect";
import { hasTentativeRoomOrderPrefix } from "sheet-ingress-api/discordComponents";
import { RoomOrderRpcs } from "sheet-ingress-api/sheet-apis-rpc";
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

export const roomOrderLayer = RoomOrderRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const dispatchService = yield* DispatchService;
    const messageRoomOrderService = yield* MessageRoomOrderService;
    const roomOrderService = yield* RoomOrderService;
    const withPayloadGuildAuth = withCurrentGuildAuthFromPayload(authorizationService);

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
      "roomOrder.handleButton": Effect.fnUntraced(function* ({ payload }) {
        const record = yield* messageRoomOrderService
          .getMessageRoomOrder(payload.messageId)
          .pipe(Effect.mapError(normalizeDispatchError("Failed to authorize room-order button")));
        if (Option.isNone(record)) {
          if (payload.action !== "pinTentative") {
            return yield* Effect.fail(
              makeArgumentError("Cannot handle room-order button, message is not registered"),
            );
          }
          return yield* withPayloadGuildAuth(
            Effect.fnUntraced(function* ({ payload }) {
              yield* authorizationService
                .requireMonitorGuild(payload.guildId)
                .pipe(
                  Effect.mapError(normalizeDispatchError("Failed to authorize room-order button")),
                );
              return yield* dispatchService
                .roomOrderButton(payload)
                .pipe(
                  Effect.mapError(normalizeDispatchError("Failed to handle room-order button")),
                );
            }),
          )({ payload });
        }
        const requiresMonitorAccess =
          payload.action === "pinTentative" ||
          ((payload.action === "previous" || payload.action === "next") &&
            (record.value.tentative || hasTentativeRoomOrderPrefix(payload.messageContent ?? "")));

        if (requiresMonitorAccess) {
          yield* requireRoomOrderMonitorAccess(authorizationService, record.value).pipe(
            Effect.mapError(normalizeDispatchError("Failed to authorize room-order button")),
          );
        }

        return yield* dispatchService
          .roomOrderButton(payload, record.value)
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
