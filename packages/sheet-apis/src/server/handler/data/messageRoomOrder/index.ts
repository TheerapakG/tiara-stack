import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { decrementMessageRoomOrderRankHandlerData } from "./decrementMessageRoomOrderRank";
import { getMessageRoomOrderHandlerData } from "./getMessageRoomOrder";
import { getMessageRoomOrderEntryHandlerData } from "./getMessageRoomOrderEntry";
import { getMessageRoomOrderRangeHandlerData } from "./getMessageRoomOrderRange";
import { incrementMessageRoomOrderRankHandlerData } from "./incrementMessageRoomOrderRank";
import { removeMessageRoomOrderEntryHandlerData } from "./removeMessageRoomOrderEntry";
import { upsertMessageRoomOrderHandlerData } from "./upsertMessageRoomOrder";
import { upsertMessageRoomOrderEntryHandlerData } from "./upsertMessageRoomOrderEntry";

export {
  decrementMessageRoomOrderRankHandlerData,
  getMessageRoomOrderHandlerData,
  getMessageRoomOrderEntryHandlerData,
  getMessageRoomOrderRangeHandlerData,
  incrementMessageRoomOrderRankHandlerData,
  removeMessageRoomOrderEntryHandlerData,
  upsertMessageRoomOrderHandlerData,
  upsertMessageRoomOrderEntryHandlerData,
};

export const messageRoomOrderHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getMessageRoomOrderHandlerData),
  HandlerData.Collection.addMutation(upsertMessageRoomOrderHandlerData),
  HandlerData.Collection.addMutation(decrementMessageRoomOrderRankHandlerData),
  HandlerData.Collection.addMutation(incrementMessageRoomOrderRankHandlerData),
  HandlerData.Collection.addSubscription(getMessageRoomOrderEntryHandlerData),
  HandlerData.Collection.addSubscription(getMessageRoomOrderRangeHandlerData),
  HandlerData.Collection.addMutation(upsertMessageRoomOrderEntryHandlerData),
  HandlerData.Collection.addMutation(removeMessageRoomOrderEntryHandlerData),
);
