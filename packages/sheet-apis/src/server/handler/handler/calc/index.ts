import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { botCalcHandler } from "./botCalc";
import { calcHandler } from "./calc";

export const calcHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.add(calcHandler),
  Context.Collection.add(botCalcHandler),
);
