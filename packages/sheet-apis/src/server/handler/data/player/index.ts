import { pipe } from "effect";
import { Data as HandlerData } from "typhoon-server/handler";

import { getPlayerMapsHandlerData } from "./getPlayerMaps";
import { getByNameHandlerData } from "./getByName";
import { getByIdHandlerData } from "./getById";
import { getTeamsByNameHandlerData } from "./getTeamsByName";
import { getTeamsByIdHandlerData } from "./getTeamsById";
import { mapScheduleWithPlayersHandlerData } from "./mapScheduleWithPlayers";

export {
  getPlayerMapsHandlerData,
  getByNameHandlerData,
  getByIdHandlerData,
  getTeamsByNameHandlerData,
  getTeamsByIdHandlerData,
  mapScheduleWithPlayersHandlerData,
};

export const playerHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getPlayerMapsHandlerData),
  HandlerData.Collection.addSubscription(getByNameHandlerData),
  HandlerData.Collection.addSubscription(getByIdHandlerData),
  HandlerData.Collection.addSubscription(getTeamsByNameHandlerData),
  HandlerData.Collection.addSubscription(getTeamsByIdHandlerData),
  HandlerData.Collection.addSubscription(mapScheduleWithPlayersHandlerData),
);
