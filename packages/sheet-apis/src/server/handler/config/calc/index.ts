import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

import { botCalcHandlerConfig } from "./botCalc";
import { calcHandlerConfig } from "./calc";

export { botCalcHandlerConfig, calcHandlerConfig };

export const calcHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(calcHandlerConfig),
  Handler.Config.Collection.add(botCalcHandlerConfig),
);
