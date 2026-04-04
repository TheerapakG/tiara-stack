import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import { provideCurrentGuildUser, requireMonitorGuild } from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { RoomOrderService } from "@/services";

export const roomOrderLayer = HttpApiBuilder.group(
  Api,
  "roomOrder",
  Effect.fn(function* (handlers) {
    const roomOrderService = yield* RoomOrderService;

    return handlers.handle("generate", ({ payload }) =>
      provideCurrentGuildUser(
        payload.guildId,
        requireMonitorGuild(payload.guildId).pipe(
          Effect.andThen(roomOrderService.generate(payload)),
        ),
      ).pipe(catchSchemaErrorAsValidationError),
    );
  }),
).pipe(Layer.provide([RoomOrderService.layer, SheetAuthTokenAuthorizationLive]));
