import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { getPlayerMapsHandlerConfig } from "./getPlayerMaps";
import { getByNameHandlerConfig } from "./getByName";
import { getByIdHandlerConfig } from "./getById";
import { getTeamsByNameHandlerConfig } from "./getTeamsByName";
import { getTeamsByIdHandlerConfig } from "./getTeamsById";
import { mapScheduleWithPlayersHandlerConfig } from "./mapScheduleWithPlayers";

export {
  getPlayerMapsHandlerConfig,
  getByNameHandlerConfig,
  getByIdHandlerConfig,
  getTeamsByNameHandlerConfig,
  getTeamsByIdHandlerConfig,
  mapScheduleWithPlayersHandlerConfig,
};

export const playerHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getPlayerMapsHandlerConfig),
  HandlerData.Collection.addSubscription(getByNameHandlerConfig),
  HandlerData.Collection.addSubscription(getByIdHandlerConfig),
  HandlerData.Collection.addSubscription(getTeamsByNameHandlerConfig),
  HandlerData.Collection.addSubscription(getTeamsByIdHandlerConfig),
  HandlerData.Collection.addSubscription(mapScheduleWithPlayersHandlerConfig),
);
