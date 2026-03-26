import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, pipe } from "effect";
import { Api } from "@/api";
import { provideCurrentGuildUser, requireMonitorGuild } from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { GuildConfigService } from "@/services/guildConfig";
import { RoomOrderService } from "@/services/roomOrder";

export const RoomOrderLive = HttpApiBuilder.group(Api, "roomOrder", (handlers) =>
  pipe(
    Effect.all({
      roomOrderService: RoomOrderService,
    }),
    Effect.map(({ roomOrderService }) =>
      handlers.handle("generate", ({ payload }) =>
        provideCurrentGuildUser(
          payload.guildId,
          requireMonitorGuild(payload.guildId).pipe(
            Effect.andThen(roomOrderService.generate(payload)),
          ),
        ),
      ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      RoomOrderService.Default,
      GuildConfigService.Default,
      SheetAuthTokenAuthorizationLive,
    ),
  ),
);
