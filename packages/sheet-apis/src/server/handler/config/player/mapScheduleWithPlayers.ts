import {
  EmptySchedule,
  EmptyScheduleWithPlayers,
  Schedule,
  ScheduleWithPlayers,
} from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { DefaultTaggedClass } from "typhoon-core/schema";

export const mapScheduleWithPlayersHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("player.mapScheduleWithPlayers"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        schedules: Schema.Array(
          Schema.Union(
            DefaultTaggedClass(Schedule),
            DefaultTaggedClass(EmptySchedule),
          ),
        ),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Schema.Array(Schema.Union(ScheduleWithPlayers, EmptyScheduleWithPlayers)),
      Schema.standardSchemaV1,
    ),
  }),
);
