import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, pipe } from "effect";
import { Api } from "@/api";
import { ScreenshotService } from "@/services/screenshot";

export const ScreenshotLive = HttpApiBuilder.group(Api, "screenshot", (handlers) =>
  pipe(
    Effect.all({
      screenshotService: ScreenshotService,
    }),
    Effect.map(({ screenshotService }) =>
      handlers.handle("getScreenshot", ({ urlParams }) =>
        screenshotService.getScreenshot(urlParams.sheetId, urlParams.channel, urlParams.day),
      ),
    ),
  ),
).pipe(Layer.provide(ScreenshotService.Default));
