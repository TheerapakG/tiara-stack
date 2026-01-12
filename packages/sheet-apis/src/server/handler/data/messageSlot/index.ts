import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { getMessageSlotDataHandlerData } from "./getMessageSlotData";
import { upsertMessageSlotDataHandlerData } from "./upsertMessageSlotData";

export { getMessageSlotDataHandlerData, upsertMessageSlotDataHandlerData };

export const messageSlotHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getMessageSlotDataHandlerData),
  HandlerData.Collection.addMutation(upsertMessageSlotDataHandlerData),
);
