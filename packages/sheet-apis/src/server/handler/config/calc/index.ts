import { pipe } from "effect";
import { HandlerConfigGroup } from "typhoon-server/config";

import { botCalcHandlerConfig } from "./botCalc";
import { calcHandlerConfig } from "./calc";

export { botCalcHandlerConfig, calcHandlerConfig };

export const calcHandlerConfigGroup = pipe(
  HandlerConfigGroup.empty(),
  HandlerConfigGroup.add(calcHandlerConfig),
  HandlerConfigGroup.add(botCalcHandlerConfig),
);
