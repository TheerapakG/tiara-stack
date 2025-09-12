import { pipe } from "effect";
import { HandlerConfigGroup } from "typhoon-server/config";
import { HandlerGroup } from "typhoon-server/server";

import { botCalcHandler, botCalcHandlerConfig } from "./botCalc";
import { calcHandler, calcHandlerConfig } from "./calc";

export const calcHandlerConfigGroup = pipe(
  HandlerConfigGroup.empty(),
  HandlerConfigGroup.add(calcHandlerConfig),
  HandlerConfigGroup.add(botCalcHandlerConfig),
);

export const calcHandlerGroup = pipe(
  HandlerGroup.empty(),
  HandlerGroup.add(calcHandler),
  HandlerGroup.add(botCalcHandler),
);
