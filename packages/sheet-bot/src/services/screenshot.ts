import { Effect, Layer, Context } from "effect";
import { SheetApisClient } from "./sheetApis";

export class ScreenshotService extends Context.Service<ScreenshotService>()("ScreenshotService", {
  make: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;

    return {
      getScreenshot: Effect.fn("ScreenshotService.getScreenshot")(function* (
        guildId: string,
        channel: string,
        day: number,
      ) {
        return yield* sheetApisClient.get().screenshot.getScreenshot({
          query: {
            guildId,
            channel,
            day,
          },
        });
      }),
    };
  }),
}) {
  static layer = Layer.effect(ScreenshotService, this.make).pipe(
    Layer.provide(SheetApisClient.layer),
  );
}
