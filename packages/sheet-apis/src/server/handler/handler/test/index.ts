import { pipe } from "effect";
import { HandlerGroup } from "typhoon-server/server";

import { testOIDCHandler } from "./testOIDC";

export const testHandlerGroup = pipe(
  HandlerGroup.empty(),
  HandlerGroup.add(testOIDCHandler),
);
