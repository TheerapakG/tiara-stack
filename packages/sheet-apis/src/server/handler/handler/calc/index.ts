import { pipe } from "effect";
import { HandlerContextConfig } from "typhoon-core/config";

import { botCalcHandler } from "./botCalc";
import { calcHandler } from "./calc";

export const calcHandlerGroup = pipe(
  HandlerContextConfig.Group.empty(),
  HandlerContextConfig.Group.add(calcHandler),
  HandlerContextConfig.Group.add(botCalcHandler),
);
