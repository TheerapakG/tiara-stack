import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { getScreenshotHandlerData } from "./getScreenshot";

export { getScreenshotHandlerData };

export const screenshotHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getScreenshotHandlerData),
);
