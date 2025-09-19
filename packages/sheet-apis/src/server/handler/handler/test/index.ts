import { pipe } from "effect";
import { HandlerContextConfig } from "typhoon-core/config";

import { testOIDCHandler } from "./testOIDC";

export const testHandlerGroup = pipe(
  HandlerContextConfig.Group.empty(),
  HandlerContextConfig.Group.add(testOIDCHandler),
);
