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
  Context.Collection.add(getMessageRoomOrderHandler),
  Context.Collection.add(upsertMessageRoomOrderHandler),
  Context.Collection.add(decrementMessageRoomOrderRankHandler),
  Context.Collection.add(incrementMessageRoomOrderRankHandler),
  Context.Collection.add(getMessageRoomOrderEntryHandler),
  Context.Collection.add(getMessageRoomOrderRangeHandler),
  Context.Collection.add(upsertMessageRoomOrderEntryHandler),
  Context.Collection.add(removeMessageRoomOrderEntryHandler),
);
