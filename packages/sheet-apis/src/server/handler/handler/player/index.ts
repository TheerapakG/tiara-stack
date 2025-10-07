import { pipe } from "effect";
import { Context } from "typhoon-server/handler";

import { getPlayerMapsHandler } from "./getPlayerMaps";
import { getByNameHandler } from "./getByName";
import { getByIdHandler } from "./getById";
import { getTeamsByNameHandler } from "./getTeamsByName";
import { getTeamsByIdHandler } from "./getTeamsById";
import { mapScheduleWithPlayersHandler } from "./mapScheduleWithPlayers";

export const playerHandlerCollection = pipe(
  Context.Collection.empty(),
  Context.Collection.add(getPlayerMapsHandler),
  Context.Collection.add(getByNameHandler),
  Context.Collection.add(getByIdHandler),
  Context.Collection.add(getTeamsByNameHandler),
  Context.Collection.add(getTeamsByIdHandler),
  Context.Collection.add(mapScheduleWithPlayersHandler),
);
