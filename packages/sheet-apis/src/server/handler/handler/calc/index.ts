import { pipe } from "effect";
import { HandlerGroup } from "typhoon-server/server";

import { botCalcHandler } from "./botCalc";
import { calcHandler } from "./calc";

export const calcHandlerGroup = pipe(
  HandlerGroup.empty(),
  HandlerGroup.add(calcHandler),
  HandlerGroup.add(botCalcHandler),
);
