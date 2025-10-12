import { pipe } from "effect";
import { Handler } from "typhoon-core/server";
import {
  calcHandlerConfigCollection,
  guildConfigHandlerConfigCollection,
  sheetConfigHandlerConfigCollection,
  playerHandlerConfigCollection,
  messageCheckinHandlerConfigCollection,
  messageRoomOrderHandlerConfigCollection,
  messageSlotHandlerConfigCollection,
} from "./server/handler/config";

export * as Schema from "./server/schema";

export const serverHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.addCollection(calcHandlerConfigCollection),
  Handler.Config.Collection.addCollection(guildConfigHandlerConfigCollection),
  Handler.Config.Collection.addCollection(sheetConfigHandlerConfigCollection),
  Handler.Config.Collection.addCollection(playerHandlerConfigCollection),
  Handler.Config.Collection.addCollection(
    messageCheckinHandlerConfigCollection,
  ),
  Handler.Config.Collection.addCollection(
    messageRoomOrderHandlerConfigCollection,
  ),
  Handler.Config.Collection.addCollection(messageSlotHandlerConfigCollection),
);
