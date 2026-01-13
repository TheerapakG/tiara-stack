import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { getMonitorMapsHandler } from "./getMonitorMaps";
import { getMonitorByIdHandler } from "./getById";
import { getMonitorByNameHandler } from "./getByName";

export const monitorHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.addSubscription(getMonitorMapsHandler),
  Context.Collection.addSubscription(getMonitorByIdHandler),
  Context.Collection.addSubscription(getMonitorByNameHandler),
);
