import { pipe } from "effect";
import { Data as CoreData } from "typhoon-core/handler";
import { Data as HandlerData } from "typhoon-server/handler";

import { getAllSchedulesHandlerData } from "./getAllSchedules";
import { getChannelSchedulesHandlerData } from "./getChannelSchedules";
import { getDaySchedulesHandlerData } from "./getDaySchedules";
import { getEventConfigHandlerData } from "./getEventConfig";
import { getPlayersHandlerData } from "./getPlayers";
import { getRangesConfigHandlerData } from "./getRangesConfig";
import { getRunnerConfigHandlerData } from "./getRunnerConfig";
import { getScheduleConfigHandlerData } from "./getScheduleConfig";
import { getTeamConfigHandlerData } from "./getTeamConfig";
import { getTeamsHandlerData } from "./getTeams";
import { getMonitorsHandlerData } from "./getMonitors";

export {
  getAllSchedulesHandlerData,
  getChannelSchedulesHandlerData,
  getDaySchedulesHandlerData,
  getEventConfigHandlerData,
  getPlayersHandlerData,
  getRangesConfigHandlerData,
  getRunnerConfigHandlerData,
  getScheduleConfigHandlerData,
  getTeamConfigHandlerData,
  getTeamsHandlerData,
  getMonitorsHandlerData,
};

export const HandlerDataGroupTypeId = CoreData.Group.HandlerDataGroupTypeId;
export const HandlerDataCollectionTypeId = CoreData.Collection.HandlerDataCollectionTypeId;

export const sheetHandlerDataCollection = pipe(
  HandlerData.Collection.empty(),
  HandlerData.Collection.addSubscription(getAllSchedulesHandlerData),
  HandlerData.Collection.addSubscription(getChannelSchedulesHandlerData),
  HandlerData.Collection.addSubscription(getDaySchedulesHandlerData),
  HandlerData.Collection.addSubscription(getEventConfigHandlerData),
  HandlerData.Collection.addSubscription(getPlayersHandlerData),
  HandlerData.Collection.addSubscription(getMonitorsHandlerData),
  HandlerData.Collection.addSubscription(getRangesConfigHandlerData),
  HandlerData.Collection.addSubscription(getRunnerConfigHandlerData),
  HandlerData.Collection.addSubscription(getScheduleConfigHandlerData),
  HandlerData.Collection.addSubscription(getTeamConfigHandlerData),
  HandlerData.Collection.addSubscription(getTeamsHandlerData),
);
