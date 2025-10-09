import { pipe } from "effect";
import { Handler } from "typhoon-core/server";

import { getAllSchedulesHandlerConfig } from "./getAllSchedules";
import { getChannelSchedulesHandlerConfig } from "./getChannelSchedules";
import { getDaySchedulesHandlerConfig } from "./getDaySchedules";
import { getEventConfigHandlerConfig } from "./getEventConfig";
import { getPlayersHandlerConfig } from "./getPlayers";
import { getRangesConfigHandlerConfig } from "./getRangesConfig";
import { getRunnerConfigHandlerConfig } from "./getRunnerConfig";
import { getScheduleConfigHandlerConfig } from "./getScheduleConfig";
import { getTeamConfigHandlerConfig } from "./getTeamConfig";
import { getTeamsHandlerConfig } from "./getTeams";

export {
  getAllSchedulesHandlerConfig,
  getChannelSchedulesHandlerConfig,
  getDaySchedulesHandlerConfig,
  getEventConfigHandlerConfig,
  getPlayersHandlerConfig,
  getRangesConfigHandlerConfig,
  getRunnerConfigHandlerConfig,
  getScheduleConfigHandlerConfig,
  getTeamConfigHandlerConfig,
  getTeamsHandlerConfig,
};

export const sheetConfigHandlerConfigCollection = pipe(
  Handler.Config.Collection.empty(),
  Handler.Config.Collection.add(getAllSchedulesHandlerConfig),
  Handler.Config.Collection.add(getChannelSchedulesHandlerConfig),
  Handler.Config.Collection.add(getDaySchedulesHandlerConfig),
  Handler.Config.Collection.add(getEventConfigHandlerConfig),
  Handler.Config.Collection.add(getPlayersHandlerConfig),
  Handler.Config.Collection.add(getRangesConfigHandlerConfig),
  Handler.Config.Collection.add(getRunnerConfigHandlerConfig),
  Handler.Config.Collection.add(getScheduleConfigHandlerConfig),
  Handler.Config.Collection.add(getTeamConfigHandlerConfig),
  Handler.Config.Collection.add(getTeamsHandlerConfig),
);
