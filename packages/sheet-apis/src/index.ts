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
} from "./server/handler/config";

export * as Schema from "./server/schema";

export const HandlerDataGroupTypeId = CoreData.Group.HandlerDataGroupTypeId;
export const HandlerDataCollectionTypeId =
  CoreData.Collection.HandlerDataCollectionTypeId;

export const PartialSubscriptionHandlerConfig =
  Handler.Config.Subscription.PartialSubscriptionHandlerConfig;
export const PartialMutationHandlerConfig =
  Handler.Config.Mutation.PartialMutationHandlerConfig;

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
