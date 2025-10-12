import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { getMessageSlotDataHandler } from "./getMessageSlotData";
import { upsertMessageSlotDataHandler } from "./upsertMessageSlotData";

export const messageSlotHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.add(getMessageSlotDataHandler),
  Context.Collection.add(upsertMessageSlotDataHandler),
);
