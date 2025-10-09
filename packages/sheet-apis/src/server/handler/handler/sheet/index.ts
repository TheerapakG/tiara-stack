import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { getRangesConfigHandler } from "./getRangesConfig";
import { getTeamConfigHandler } from "./getTeamConfig";
import { getEventConfigHandler } from "./getEventConfig";
import { getScheduleConfigHandler } from "./getScheduleConfig";
import { getRunnerConfigHandler } from "./getRunnerConfig";
import { getPlayersHandler } from "./getPlayers";
import { getTeamsHandler } from "./getTeams";
import { getAllSchedulesHandler } from "./getAllSchedules";
import { getDaySchedulesHandler } from "./getDaySchedules";
import { getChannelSchedulesHandler } from "./getChannelSchedules";

export const sheetHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.add(getRangesConfigHandler),
  Context.Collection.add(getTeamConfigHandler),
  Context.Collection.add(getEventConfigHandler),
  Context.Collection.add(getScheduleConfigHandler),
  Context.Collection.add(getRunnerConfigHandler),
  Context.Collection.add(getPlayersHandler),
  Context.Collection.add(getTeamsHandler),
  Context.Collection.add(getAllSchedulesHandler),
  Context.Collection.add(getDaySchedulesHandler),
  Context.Collection.add(getChannelSchedulesHandler),
);
