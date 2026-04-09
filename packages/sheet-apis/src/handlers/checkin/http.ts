import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { AuthorizationService, CheckinService } from "@/services";

export const checkinLayer = HttpApiBuilder.group(
  Api,
  "checkin",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const checkinService = yield* CheckinService;

    return handlers.handle("generate", ({ payload }) =>
      authorizationService.provideCurrentGuildUser(
        payload.guildId,
        Effect.gen(function* () {
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
