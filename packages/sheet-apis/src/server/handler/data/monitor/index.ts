import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { monitorGetMonitorMapsHandlerData } from "./getMonitorMaps";
import { monitorGetByIdHandlerData } from "./getById";
import { monitorGetByNameHandlerData } from "./getByName";

export { monitorGetMonitorMapsHandlerData, monitorGetByIdHandlerData, monitorGetByNameHandlerData };

export const monitorHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(monitorGetMonitorMapsHandlerData),
  HandlerData.Collection.addSubscription(monitorGetByIdHandlerData),
  HandlerData.Collection.addSubscription(monitorGetByNameHandlerData),
);
