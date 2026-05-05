import { Effect, Layer } from "effect";
import { RoomOrderRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { withCurrentGuildAuthFromPayload } from "@/handlers/shared/guildAuthorization";
import { AuthorizationService, RoomOrderService } from "@/services";

export const roomOrderLayer = RoomOrderRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const roomOrderService = yield* RoomOrderService;
    const withPayloadGuildAuth = withCurrentGuildAuthFromPayload(authorizationService);

    return {
      "roomOrder.generate": withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* roomOrderService.generate(payload);
        }),
      ),
    };
  }),
).pipe(Layer.provide([AuthorizationService.layer, RoomOrderService.layer]));
