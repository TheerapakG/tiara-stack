import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

import { getScreenshotHandlerConfig } from "./getScreenshot";

export { getScreenshotHandlerConfig };

export const screenshotHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(getScreenshotHandlerConfig),
);
