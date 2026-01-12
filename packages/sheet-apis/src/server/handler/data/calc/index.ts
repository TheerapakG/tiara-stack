import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { botCalcHandlerData } from "./botCalc";
import { sheetCalcHandlerData } from "./sheetCalc";

export { botCalcHandlerData, sheetCalcHandlerData };

export const calcHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(botCalcHandlerData),
  HandlerData.Collection.addSubscription(sheetCalcHandlerData),
);
