import { pipe } from "effect";
import { Data as CoreData } from "typhoon-core/handler";
import { Data as HandlerData } from "typhoon-server/handler";

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

export const HandlerDataGroupTypeId = CoreData.Group.HandlerDataGroupTypeId;
export const HandlerDataCollectionTypeId = CoreData.Collection.HandlerDataCollectionTypeId;

export const sheetHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getAllSchedulesHandlerConfig),
  HandlerData.Collection.addSubscription(getChannelSchedulesHandlerConfig),
  HandlerData.Collection.addSubscription(getDaySchedulesHandlerConfig),
  HandlerData.Collection.addSubscription(getEventConfigHandlerConfig),
  HandlerData.Collection.addSubscription(getPlayersHandlerConfig),
  HandlerData.Collection.addSubscription(getRangesConfigHandlerConfig),
  HandlerData.Collection.addSubscription(getRunnerConfigHandlerConfig),
  HandlerData.Collection.addSubscription(getScheduleConfigHandlerConfig),
  HandlerData.Collection.addSubscription(getTeamConfigHandlerConfig),
  HandlerData.Collection.addSubscription(getTeamsHandlerConfig),
);
