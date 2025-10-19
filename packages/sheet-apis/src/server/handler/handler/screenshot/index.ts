import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { getScreenshotHandler } from "./getScreenshot";

export const screenshotHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.add(getScreenshotHandler),
);
