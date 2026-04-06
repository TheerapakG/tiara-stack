import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { AuthorizationService, RoomOrderService } from "@/services";

export const roomOrderLayer = HttpApiBuilder.group(
  Api,
  "roomOrder",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const roomOrderService = yield* RoomOrderService;

    return handlers.handle("generate", ({ payload }) =>
      authorizationService
        .provideCurrentGuildUser(
          payload.guildId,
          authorizationService
            .requireMonitorGuild(payload.guildId)
            .pipe(Effect.andThen(roomOrderService.generate(payload))),
        )
        .pipe(catchSchemaErrorAsValidationError),
    );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    RoomOrderService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
