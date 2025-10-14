import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { botCalcHandler } from "./botCalc";
import { sheetCalcHandler } from "./sheetCalc";

export const calcHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.add(botCalcHandler),
  Context.Collection.add(sheetCalcHandler),
);
