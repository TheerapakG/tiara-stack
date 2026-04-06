import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { AuthorizationService, CheckinService } from "@/services";

export const checkinLayer = HttpApiBuilder.group(
  Api,
  "checkin",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const checkinService = yield* CheckinService;

    return handlers.handle("generate", ({ payload }) =>
      authorizationService
        .provideCurrentGuildUser(
          payload.guildId,
          authorizationService
            .requireMonitorGuild(payload.guildId)
            .pipe(Effect.andThen(checkinService.generate(payload))),
        )
        .pipe(catchSchemaErrorAsValidationError),
    );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    CheckinService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
