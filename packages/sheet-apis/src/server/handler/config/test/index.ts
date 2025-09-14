import { pipe } from "effect";
import { HandlerConfigGroup } from "typhoon-server/config";

import { testOIDCHandlerConfig } from "./testOIDC";

export { testOIDCHandlerConfig };

export const testHandlerConfigGroup = pipe(
  HandlerConfigGroup.empty(),
  HandlerConfigGroup.add(testOIDCHandlerConfig),
);
