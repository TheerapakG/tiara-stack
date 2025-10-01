import { pipe } from "effect";
import { Handler } from "typhoon-core/server";
import {
  calcHandlerConfigCollection,
  guildConfigHandlerConfigCollection,
} from "./server/handler/config";

export * as Schema from "./server/schema";

export const serverHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.addCollection(calcHandlerConfigCollection),
  Handler.Config.Collection.addCollection(guildConfigHandlerConfigCollection),
);
