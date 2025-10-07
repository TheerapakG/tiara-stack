import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

import { Schedule, ScheduleWithPlayers } from "@/server/schema";

export const mapScheduleWithPlayersHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("mutation"),
  Handler.Config.Builder.name("player.mapScheduleWithPlayers"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        schedules: Schema.Array(Schedule),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(Schema.Array(ScheduleWithPlayers), Schema.standardSchemaV1),
  }),
);
