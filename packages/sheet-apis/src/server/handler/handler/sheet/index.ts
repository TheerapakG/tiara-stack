import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { getRangesConfigHandler } from "./getRangesConfig";
import { getTeamConfigHandler } from "./getTeamConfig";
import { getEventConfigHandler } from "./getEventConfig";
import { getScheduleConfigHandler } from "./getScheduleConfig";
import { getRunnerConfigHandler } from "./getRunnerConfig";
import { getPlayersHandler } from "./getPlayers";
import { getMonitorsHandler } from "./getMonitors";
import { getTeamsHandler } from "./getTeams";
import { getAllSchedulesHandler } from "./getAllSchedules";
import { getDaySchedulesHandler } from "./getDaySchedules";
import { getChannelSchedulesHandler } from "./getChannelSchedules";

export const sheetHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.addSubscription(getRangesConfigHandler),
  Context.Collection.addSubscription(getTeamConfigHandler),
  Context.Collection.addSubscription(getEventConfigHandler),
  Context.Collection.addSubscription(getScheduleConfigHandler),
  Context.Collection.addSubscription(getRunnerConfigHandler),
  Context.Collection.addSubscription(getPlayersHandler),
  Context.Collection.addSubscription(getMonitorsHandler),
  Context.Collection.addSubscription(getTeamsHandler),
  Context.Collection.addSubscription(getAllSchedulesHandler),
  Context.Collection.addSubscription(getDaySchedulesHandler),
  Context.Collection.addSubscription(getChannelSchedulesHandler),
);
