import { Effect, Layer } from "effect";
import { CheckinRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { withCurrentGuildAuthFromPayload } from "@/handlers/shared/guildAuthorization";
import { AuthorizationService, CheckinService } from "@/services";

export const checkinLayer = CheckinRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const checkinService = yield* CheckinService;
    const withPayloadGuildAuth = withCurrentGuildAuthFromPayload(authorizationService);

    return {
      "checkin.generate": withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* checkinService.generate(payload);
        }),
      ),
    };
  }),
).pipe(Layer.provide([AuthorizationService.layer, CheckinService.layer]));
