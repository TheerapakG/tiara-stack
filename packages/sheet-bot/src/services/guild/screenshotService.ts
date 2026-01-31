import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
import { SheetApisClient } from "@/client/sheetApis";
import { GuildService } from "./guildService";

export class ScreenshotService extends Effect.Service<ScreenshotService>()("ScreenshotService", {
  effect: pipe(
    Effect.Do,
    bindObject({
      guildService: GuildService,
      sheetApisClient: SheetApisClient,
    }),
    Effect.map(({ guildService, sheetApisClient }) => ({
      getScreenshot: (channel: string, day: number) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().screenshot.getScreenshot({
              urlParams: {
                guildId,
                channel,
                day,
              },
            }),
          ),
          Effect.withSpan("ScreenshotService.getScreenshot", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
