import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import { PopulatedScheduleResponse, ScheduleView } from "@/schemas/sheet";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";

const ScheduleError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
);

const ScheduleViewUrlParam = Schema.optional(ScheduleView);

export class ScheduleApi extends HttpApiGroup.make("schedule")
  .add(
    HttpApiEndpoint.get("getAllPopulatedSchedules", "/schedule/getAllPopulatedSchedules")
      .setUrlParams(Schema.Struct({ guildId: Schema.String, view: ScheduleViewUrlParam }))
      .addSuccess(PopulatedScheduleResponse)
      .addError(ScheduleError),
  )
  .add(
    HttpApiEndpoint.get("getDayPopulatedSchedules", "/schedule/getDayPopulatedSchedules")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
          day: Schema.NumberFromString,
          view: ScheduleViewUrlParam,
        }),
      )
      .addSuccess(PopulatedScheduleResponse)
      .addError(ScheduleError),
  )
  .add(
    HttpApiEndpoint.get("getChannelPopulatedSchedules", "/schedule/getChannelPopulatedSchedules")
      .setUrlParams(
        Schema.Struct({
          guildId: Schema.String,
          channel: Schema.String,
          view: ScheduleViewUrlParam,
        }),
      )
      .addSuccess(PopulatedScheduleResponse)
      .addError(ScheduleError),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Schedule")
  .annotate(OpenApi.Description, "Populated schedule data endpoints") {}
