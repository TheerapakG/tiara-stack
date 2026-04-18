import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { withCurrentGuildAuthFromPayload } from "@/handlers/shared/guildAuthorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { AuthorizationService, CheckinService } from "@/services";

export const checkinLayer = HttpApiBuilder.group(
  Api,
  "checkin",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const checkinService = yield* CheckinService;
    const withPayloadGuildAuth = withCurrentGuildAuthFromPayload(authorizationService);

    return handlers.handle(
      "generate",
      withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* checkinService.generate(payload);
        }),
      ),
    );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    CheckinService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
