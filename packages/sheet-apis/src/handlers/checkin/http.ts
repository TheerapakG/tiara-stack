import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, pipe } from "effect";
import { Api } from "@/api";
import { catchParseErrorAsValidationError } from "typhoon-core/error";
import { provideCurrentGuildUser, requireMonitorGuild } from "@/middlewares/authorization";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { CheckinService } from "@/services/checkin";
import { GuildConfigService } from "@/services/guildConfig";

export const CheckinLive = HttpApiBuilder.group(Api, "checkin", (handlers) =>
  pipe(
    Effect.all({
      checkinService: CheckinService,
    }),
    Effect.map(({ checkinService }) =>
      handlers.handle("generate", ({ payload }) =>
        provideCurrentGuildUser(
          payload.guildId,
          requireMonitorGuild(payload.guildId).pipe(
            Effect.andThen(checkinService.generate(payload)),
          ),
        ).pipe(catchParseErrorAsValidationError),
      ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      CheckinService.Default,
      GuildConfigService.Default,
      SheetAuthTokenAuthorizationLive,
    ),
  ),
);
