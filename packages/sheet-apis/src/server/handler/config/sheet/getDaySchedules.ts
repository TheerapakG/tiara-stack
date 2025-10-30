import { Schedule, ScheduleIndex } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const getDaySchedulesHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("sheet.getDaySchedules"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        day: Schema.Number,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Config.Builder.response({
    validator: pipe(
      Schema.HashMap({
        key: ScheduleIndex,
        value: Schema.HashMap({
          key: Schema.Number,
          value: Schedule,
        }),
      }),
      Schema.standardSchemaV1,
    ),
  }),
);
