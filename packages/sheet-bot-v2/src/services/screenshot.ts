import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class ScreenshotService extends Effect.Service<ScreenshotService>()("ScreenshotService", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      getScreenshot: Effect.fn("ScreenshotService.getScreenshot")(
        (guildId: string, channel: string, day: number) =>
          sheetApisClient.get().screenshot.getScreenshot({
            urlParams: {
              guildId,
              channel,
              day,
            },
          }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
