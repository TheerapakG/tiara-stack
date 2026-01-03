import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { getMessageSlotDataHandlerConfig } from "./getMessageSlotData";
import { upsertMessageSlotDataHandlerConfig } from "./upsertMessageSlotData";

export { getMessageSlotDataHandlerConfig, upsertMessageSlotDataHandlerConfig };

export const messageSlotHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getMessageSlotDataHandlerConfig),
  HandlerData.Collection.addMutation(upsertMessageSlotDataHandlerConfig),
);
