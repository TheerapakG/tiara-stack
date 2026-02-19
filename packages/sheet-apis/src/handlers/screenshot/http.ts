import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { ScreenshotService } from "@/services/screenshot";
import { GuildConfigService } from "@/services/guildConfig";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";

const getSheetIdFromGuildId = (guildId: string, guildConfigService: GuildConfigService) =>
  pipe(
    guildConfigService.getGuildConfigByGuildId(guildId),
    Effect.flatMap(
      Option.match({
        onSome: (guildConfig) =>
          pipe(
            guildConfig.sheetId,
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(new Error(`sheetId not found for guildId: ${guildId}`)),
            }),
          ),
        onNone: () => Effect.die(new Error(`Guild config not found for guildId: ${guildId}`)),
      }),
    ),
  );

export const ScreenshotLive = HttpApiBuilder.group(Api, "screenshot", (handlers) =>
  pipe(
    Effect.all({
      screenshotService: ScreenshotService,
      guildConfigService: GuildConfigService,
    }),
    Effect.map(({ screenshotService, guildConfigService }) =>
      handlers.handle("getScreenshot", ({ urlParams }) =>
        pipe(
          getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
          Effect.flatMap((sheetId) =>
            screenshotService.getScreenshot(sheetId, urlParams.channel, urlParams.day),
          ),
        ),
      ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      ScreenshotService.Default,
      GuildConfigService.Default,
      SheetAuthTokenAuthorizationLive,
    ),
  ),
);
