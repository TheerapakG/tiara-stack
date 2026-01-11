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
  Context.Collection.addSubscription(getPlayerMapsHandler),
  Context.Collection.addSubscription(getByNameHandler),
  Context.Collection.addSubscription(getByIdHandler),
  Context.Collection.addSubscription(getTeamsByNameHandler),
  Context.Collection.addSubscription(getTeamsByIdHandler),
  Context.Collection.addSubscription(mapScheduleWithPlayersHandler),
);
