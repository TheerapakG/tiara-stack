import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import { provideCurrentGuildUser, requireMonitorGuild } from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { CheckinService } from "@/services";

export const checkinLayer = HttpApiBuilder.group(
  Api,
  "checkin",
  Effect.fn(function* (handlers) {
    const checkinService = yield* CheckinService;

    return handlers.handle("generate", ({ payload }) =>
      provideCurrentGuildUser(
        payload.guildId,
        requireMonitorGuild(payload.guildId).pipe(Effect.andThen(checkinService.generate(payload))),
      ).pipe(catchSchemaErrorAsValidationError),
    );
  }),
).pipe(Layer.provide([CheckinService.layer, SheetAuthTokenAuthorizationLive]));
