import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { getRangesConfigHandler } from "./getRangesConfig";
import { getTeamConfigHandler } from "./getTeamConfig";
import { getEventConfigHandler } from "./getEventConfig";
import { getDayConfigHandler } from "./getDayConfig";
import { getRunnerConfigHandler } from "./getRunnerConfig";
import { getPlayersHandler } from "./getPlayers";
import { getTeamsHandler } from "./getTeams";
import { getAllSchedulesHandler } from "./getAllSchedules";
import { getDaySchedulesHandler } from "./getDaySchedules";

export const sheetHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.add(getRangesConfigHandler),
  Context.Collection.add(getTeamConfigHandler),
  Context.Collection.add(getEventConfigHandler),
  Context.Collection.add(getDayConfigHandler),
  Context.Collection.add(getRunnerConfigHandler),
  Context.Collection.add(getPlayersHandler),
  Context.Collection.add(getTeamsHandler),
  Context.Collection.add(getAllSchedulesHandler),
  Context.Collection.add(getDaySchedulesHandler),
);
