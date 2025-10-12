import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

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

export const messageRoomOrderHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(getMessageRoomOrderHandlerConfig),
  Handler.Config.Collection.add(upsertMessageRoomOrderHandlerConfig),
  Handler.Config.Collection.add(decrementMessageRoomOrderRankHandlerConfig),
  Handler.Config.Collection.add(incrementMessageRoomOrderRankHandlerConfig),
  Handler.Config.Collection.add(getMessageRoomOrderEntryHandlerConfig),
  Handler.Config.Collection.add(getMessageRoomOrderRangeHandlerConfig),
  Handler.Config.Collection.add(upsertMessageRoomOrderEntryHandlerConfig),
  Handler.Config.Collection.add(removeMessageRoomOrderEntryHandlerConfig),
);
