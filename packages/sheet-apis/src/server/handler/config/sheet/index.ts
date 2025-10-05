import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

import { getRangesConfigHandlerConfig } from "./getRangesConfig";
import { getTeamConfigHandlerConfig } from "./getTeamConfig";
import { getEventConfigHandlerConfig } from "./getEventConfig";
import { getDayConfigHandlerConfig } from "./getDayConfig";
import { getRunnerConfigHandlerConfig } from "./getRunnerConfig";
import { getPlayersHandlerConfig } from "./getPlayers";
import { getTeamsHandlerConfig } from "./getTeams";
import { getAllSchedulesHandlerConfig } from "./getAllSchedules";
import { getDaySchedulesHandlerConfig } from "./getDaySchedules";

export {
  getRangesConfigHandlerConfig,
  getTeamConfigHandlerConfig,
  getEventConfigHandlerConfig,
  getDayConfigHandlerConfig,
  getRunnerConfigHandlerConfig,
  getPlayersHandlerConfig,
  getTeamsHandlerConfig,
  getAllSchedulesHandlerConfig,
  getDaySchedulesHandlerConfig,
};

export const sheetConfigHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(getRangesConfigHandlerConfig),
  Handler.Config.Collection.add(getTeamConfigHandlerConfig),
  Handler.Config.Collection.add(getEventConfigHandlerConfig),
  Handler.Config.Collection.add(getDayConfigHandlerConfig),
  Handler.Config.Collection.add(getRunnerConfigHandlerConfig),
  Handler.Config.Collection.add(getPlayersHandlerConfig),
  Handler.Config.Collection.add(getTeamsHandlerConfig),
  Handler.Config.Collection.add(getAllSchedulesHandlerConfig),
  Handler.Config.Collection.add(getDaySchedulesHandlerConfig),
);
