import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

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

export const playerHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(getPlayerMapsHandlerConfig),
  Handler.Config.Collection.add(getByNameHandlerConfig),
  Handler.Config.Collection.add(getByIdHandlerConfig),
  Handler.Config.Collection.add(getTeamsByNameHandlerConfig),
  Handler.Config.Collection.add(getTeamsByIdHandlerConfig),
  Handler.Config.Collection.add(mapScheduleWithPlayersHandlerConfig),
);
