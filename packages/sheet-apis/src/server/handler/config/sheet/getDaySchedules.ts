import { BreakSchedule, Schedule } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

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
      Result.ResultSchema({
        optimistic: Schema.Array(Schema.Union(Schedule, BreakSchedule)),
        complete: Schema.Array(Schema.Union(Schedule, BreakSchedule)),
      }),
      Schema.standardSchemaV1,
    ),
  }),
);
