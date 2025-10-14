import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

import { botCalcHandlerConfig } from "./botCalc";
import { sheetCalcHandlerConfig } from "./sheetCalc";

export { botCalcHandlerConfig, sheetCalcHandlerConfig };

export const calcHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(botCalcHandlerConfig),
  Handler.Config.Collection.add(sheetCalcHandlerConfig),
);
