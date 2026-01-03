import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { decrementMessageRoomOrderRankHandlerConfig } from "./decrementMessageRoomOrderRank";
import { getMessageRoomOrderHandlerConfig } from "./getMessageRoomOrder";
import { getMessageRoomOrderEntryHandlerConfig } from "./getMessageRoomOrderEntry";
import { getMessageRoomOrderRangeHandlerConfig } from "./getMessageRoomOrderRange";
import { incrementMessageRoomOrderRankHandlerConfig } from "./incrementMessageRoomOrderRank";
import { removeMessageRoomOrderEntryHandlerConfig } from "./removeMessageRoomOrderEntry";
import { upsertMessageRoomOrderHandlerConfig } from "./upsertMessageRoomOrder";
import { upsertMessageRoomOrderEntryHandlerConfig } from "./upsertMessageRoomOrderEntry";

export {
  decrementMessageRoomOrderRankHandlerConfig,
  getMessageRoomOrderHandlerConfig,
  getMessageRoomOrderEntryHandlerConfig,
  getMessageRoomOrderRangeHandlerConfig,
  incrementMessageRoomOrderRankHandlerConfig,
  removeMessageRoomOrderEntryHandlerConfig,
  upsertMessageRoomOrderHandlerConfig,
  upsertMessageRoomOrderEntryHandlerConfig,
};

export const messageRoomOrderHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getMessageRoomOrderHandlerConfig),
  HandlerData.Collection.addMutation(upsertMessageRoomOrderHandlerConfig),
  HandlerData.Collection.addMutation(
    decrementMessageRoomOrderRankHandlerConfig,
  ),
  HandlerData.Collection.addMutation(
    incrementMessageRoomOrderRankHandlerConfig,
  ),
  HandlerData.Collection.addSubscription(getMessageRoomOrderEntryHandlerConfig),
  HandlerData.Collection.addSubscription(getMessageRoomOrderRangeHandlerConfig),
  HandlerData.Collection.addMutation(upsertMessageRoomOrderEntryHandlerConfig),
  HandlerData.Collection.addMutation(removeMessageRoomOrderEntryHandlerConfig),
);
