import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import { AuthorizationService, ScreenshotService, GuildConfigService } from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";

const getSheetIdFromGuildId = (
  guildId: string,
  guildConfigService: typeof GuildConfigService.Service,
) =>
  pipe(
    guildConfigService.getGuildConfig(guildId),
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

export const screenshotLayer = HttpApiBuilder.group(
  Api,
  "screenshot",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const screenshotService = yield* ScreenshotService;
    const guildConfigService = yield* GuildConfigService;

    return handlers.handle("getScreenshot", ({ query }) =>
      authorizationService
        .provideCurrentGuildUser(
          query.guildId,
          authorizationService.requireMonitorGuild(query.guildId).pipe(
            Effect.andThen(
              pipe(
                getSheetIdFromGuildId(query.guildId, guildConfigService),
                Effect.flatMap((sheetId) =>
                  screenshotService.getScreenshot(sheetId, query.channel, query.day),
                ),
              ),
            ),
          ),
        )
        .pipe(catchSchemaErrorAsValidationError),
    );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    ScreenshotService.layer,
    GuildConfigService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
