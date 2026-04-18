import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer, Option } from "effect";
import { Api } from "@/api";
import { withCurrentGuildAuthFromQuery } from "@/handlers/shared/guildAuthorization";
import { AuthorizationService, ScreenshotService, GuildConfigService } from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";

const getSheetIdFromGuildId = Effect.fn("screenshot.getSheetIdFromGuildId")(function* (
  guildId: string,
  guildConfigService: typeof GuildConfigService.Service,
) {
  const guildConfig = yield* guildConfigService.getGuildConfig(guildId);

  if (Option.isNone(guildConfig)) {
    return yield* Effect.die(new Error(`Guild config not found for guildId: ${guildId}`));
  }

  if (Option.isNone(guildConfig.value.sheetId)) {
    return yield* Effect.die(new Error(`sheetId not found for guildId: ${guildId}`));
  }

  return guildConfig.value.sheetId.value;
});

export const screenshotLayer = HttpApiBuilder.group(
  Api,
  "screenshot",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const screenshotService = yield* ScreenshotService;
    const guildConfigService = yield* GuildConfigService;
    const withQueryGuildAuth = withCurrentGuildAuthFromQuery(authorizationService);

    return handlers.handle(
      "getScreenshot",
      withQueryGuildAuth(
        Effect.fnUntraced(function* ({ query }) {
          yield* authorizationService.requireMonitorGuild(query.guildId);
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* screenshotService.getScreenshot(sheetId, query.channel, query.day);
        }),
      ),
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
