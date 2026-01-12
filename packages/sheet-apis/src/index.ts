import { pipe } from "effect";
import { Handler } from "typhoon-core/server";
import { Data as CoreData } from "typhoon-core/handler";
import { Data as HandlerData } from "typhoon-server/handler";
import {
  calcHandlerDataCollection,
  guildConfigHandlerDataCollection,
  sheetHandlerDataCollection,
  playerHandlerDataCollection,
  messageCheckinHandlerDataCollection,
  messageRoomOrderHandlerDataCollection,
  messageSlotHandlerDataCollection,
  screenshotHandlerDataCollection,
} from "./server/handler/data";

export * as Schema from "./server/schema";

export const HandlerDataGroupTypeId = CoreData.Group.HandlerDataGroupTypeId;
export const HandlerDataCollectionTypeId = CoreData.Collection.HandlerDataCollectionTypeId;

export const PartialSubscriptionHandlerData =
  Handler.Data.Subscription.PartialSubscriptionHandlerData;
export const PartialMutationHandlerData = Handler.Data.Mutation.PartialMutationHandlerData;

export const serverHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addCollection(calcHandlerDataCollection),
  HandlerData.Collection.addCollection(guildConfigHandlerDataCollection),
  HandlerData.Collection.addCollection(sheetHandlerDataCollection),
  HandlerData.Collection.addCollection(playerHandlerDataCollection),
  HandlerData.Collection.addCollection(messageCheckinHandlerDataCollection),
  HandlerData.Collection.addCollection(messageRoomOrderHandlerDataCollection),
  HandlerData.Collection.addCollection(messageSlotHandlerDataCollection),
  HandlerData.Collection.addCollection(screenshotHandlerDataCollection),
);
