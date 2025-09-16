import { pipe } from "effect";
import { HandlerConfig } from "typhoon-core/config";

import { botCalcHandlerConfig } from "./botCalc";
import { calcHandlerConfig } from "./calc";

export { botCalcHandlerConfig, calcHandlerConfig };

export const calcHandlerConfigGroup = pipe(
  HandlerConfig.Group.empty(),
  HandlerConfig.Group.add(calcHandlerConfig),
  HandlerConfig.Group.add(botCalcHandlerConfig),
);
