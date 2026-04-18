import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer } from "effect";
import { Api } from "@/api";
import { withCurrentGuildAuthFromPayload } from "@/handlers/shared/guildAuthorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { AuthorizationService, RoomOrderService } from "@/services";

export const roomOrderLayer = HttpApiBuilder.group(
  Api,
  "roomOrder",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const roomOrderService = yield* RoomOrderService;
    const withPayloadGuildAuth = withCurrentGuildAuthFromPayload(authorizationService);

    return handlers.handle(
      "generate",
      withPayloadGuildAuth(
        Effect.fnUntraced(function* ({ payload }) {
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
