import { pipe } from "effect";
import { HandlerConfig } from "typhoon-core/config";

import { testOIDCHandlerConfig } from "./testOIDC";

export { testOIDCHandlerConfig };

export const testHandlerConfigGroup = pipe(
  HandlerConfig.Group.empty(),
  HandlerConfig.Group.add(testOIDCHandlerConfig),
);
