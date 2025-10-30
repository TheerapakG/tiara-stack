import { Schedule, ScheduleIndex } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";

export const getAllSchedulesHandlerConfig = pipe(
  Handler.Config.empty(),
  Handler.Config.Builder.type("subscription"),
  Handler.Config.Builder.name("sheet.getAllSchedules"),
  Handler.Config.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
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
