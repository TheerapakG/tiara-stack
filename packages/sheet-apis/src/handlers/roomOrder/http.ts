import { Effect, Layer } from "effect";
import { RoomOrderRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { normalizeDispatchError } from "@/handlers/shared/dispatchError";
import { withCurrentGuildAuthFromPayload } from "@/handlers/shared/guildAuthorization";
import { AuthorizationService, DispatchService, RoomOrderService } from "@/services";

export const roomOrderLayer = RoomOrderRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const dispatchService = yield* DispatchService;
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
    };
  }),
).pipe(Layer.provide([AuthorizationService.layer, DispatchService.layer, RoomOrderService.layer]));
