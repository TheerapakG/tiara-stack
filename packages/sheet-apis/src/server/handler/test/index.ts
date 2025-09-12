import { pipe } from "effect";
import { HandlerConfigGroup } from "typhoon-server/config";
import { HandlerGroup } from "typhoon-server/server";

import { testOIDCHandler, testOIDCHandlerConfig } from "./testOIDC";

export const testHandlerConfigGroup = pipe(
  HandlerConfigGroup.empty(),
  HandlerConfigGroup.add(testOIDCHandlerConfig),
);

export const testHandlerGroup = pipe(
  HandlerGroup.empty(),
  HandlerGroup.add(testOIDCHandler),
);
