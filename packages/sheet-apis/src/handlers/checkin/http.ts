import { Effect, Layer } from "effect";
import { CheckinRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { normalizeDispatchError } from "@/handlers/shared/dispatchError";
import { withCurrentGuildAuthFromPayload } from "@/handlers/shared/guildAuthorization";
import { AuthorizationService, CheckinService, DispatchService } from "@/services";

export const checkinLayer = CheckinRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const checkinService = yield* CheckinService;
    const dispatchService = yield* DispatchService;
    const withPayloadGuildAuth = withCurrentGuildAuthFromPayload(authorizationService);

    return {
      "checkin.generate": withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* checkinService.generate(payload);
        }),
      ),
      "checkin.dispatch": withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
          // withPayloadGuildAuth provides guild-scoped auth context; this enforces monitor access.
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* dispatchService
            .checkin(payload)
            .pipe(Effect.mapError(normalizeDispatchError("Failed to dispatch check-in")));
        }),
      ),
    };
  }),
).pipe(Layer.provide([AuthorizationService.layer, CheckinService.layer, DispatchService.layer]));
