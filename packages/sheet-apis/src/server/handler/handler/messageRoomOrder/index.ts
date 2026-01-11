import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { decrementMessageRoomOrderRankHandler } from "./decrementMessageRoomOrderRank";
import { getMessageRoomOrderHandler } from "./getMessageRoomOrder";
import { getMessageRoomOrderEntryHandler } from "./getMessageRoomOrderEntry";
import { getMessageRoomOrderRangeHandler } from "./getMessageRoomOrderRange";
import { incrementMessageRoomOrderRankHandler } from "./incrementMessageRoomOrderRank";
import { removeMessageRoomOrderEntryHandler } from "./removeMessageRoomOrderEntry";
import { upsertMessageRoomOrderHandler } from "./upsertMessageRoomOrder";
import { upsertMessageRoomOrderEntryHandler } from "./upsertMessageRoomOrderEntry";

export const messageRoomOrderHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.addSubscription(getMessageRoomOrderHandler),
  Context.Collection.addMutation(upsertMessageRoomOrderHandler),
  Context.Collection.addMutation(decrementMessageRoomOrderRankHandler),
  Context.Collection.addMutation(incrementMessageRoomOrderRankHandler),
  Context.Collection.addSubscription(getMessageRoomOrderEntryHandler),
  Context.Collection.addSubscription(getMessageRoomOrderRangeHandler),
  Context.Collection.addMutation(upsertMessageRoomOrderEntryHandler),
  Context.Collection.addMutation(removeMessageRoomOrderEntryHandler),
);
