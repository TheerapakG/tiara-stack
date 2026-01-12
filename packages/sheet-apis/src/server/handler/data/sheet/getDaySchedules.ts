import { BreakSchedule, Schedule, Error } from "@/server/schema";
import { pipe, Schema } from "effect";
import { Handler } from "typhoon-core/server";
import { Result } from "typhoon-core/schema";

export const getDaySchedulesHandlerData = pipe(
  Handler.Data.empty(),
  Handler.Data.Builder.type("subscription"),
  Handler.Data.Builder.name("sheet.getDaySchedules"),
  Handler.Data.Builder.requestParams({
    validator: pipe(
      Schema.Struct({
        guildId: Schema.String,
        day: Schema.Number,
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.response({
    validator: pipe(
      Result.ResultSchema({
        optimistic: Schema.Either({
          right: Schema.Array(Schema.Union(Schedule, BreakSchedule)),
          left: Schema.Union(
            Error.Core.ArgumentError,
            Error.Core.MsgpackDecodeError,
            Error.Core.StreamExhaustedError,
            Error.Core.ValidationError,
            Error.GoogleSheetsError,
            Error.ParserFieldError,
            Error.SheetConfigError,
            Error.Core.ZeroQueryError,
          ),
        }),
        complete: Schema.Either({
          right: Schema.Array(Schema.Union(Schedule, BreakSchedule)),
          left: Schema.Union(
            Error.Core.ArgumentError,
            Error.Core.MsgpackDecodeError,
            Error.Core.StreamExhaustedError,
            Error.Core.ValidationError,
            Error.GoogleSheetsError,
            Error.ParserFieldError,
            Error.SheetConfigError,
            Error.Core.ZeroQueryError,
          ),
        }),
      }),
      Schema.standardSchemaV1,
    ),
  }),
  Handler.Data.Builder.responseError({
    validator: pipe(
      Schema.Union(
        Error.Core.AuthorizationError,
        Error.Core.MsgpackDecodeError,
        Error.Core.StreamExhaustedError,
        Error.Core.ValidationError,
      ),
      Schema.standardSchemaV1,
    ),
  }),
);
