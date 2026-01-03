import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { botCalcHandlerConfig } from "./botCalc";
import { sheetCalcHandlerConfig } from "./sheetCalc";

export { botCalcHandlerConfig, sheetCalcHandlerConfig };

export const calcHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(botCalcHandlerConfig),
  HandlerData.Collection.addSubscription(sheetCalcHandlerConfig),
);
