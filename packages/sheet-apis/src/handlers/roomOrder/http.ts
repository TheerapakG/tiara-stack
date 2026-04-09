import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { AuthorizationService, RoomOrderService } from "@/services";

export const roomOrderLayer = HttpApiBuilder.group(
  Api,
  "roomOrder",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const roomOrderService = yield* RoomOrderService;

    return handlers.handle("generate", ({ payload }) =>
      authorizationService.provideCurrentGuildUser(
        payload.guildId,
        Effect.gen(function* () {
          yield* authorizationService.requireMonitorGuild(payload.guildId);
          return yield* roomOrderService.generate(payload);
        }),
      ),
    );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    RoomOrderService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
