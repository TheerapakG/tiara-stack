import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";
import { SchemaError, QueryResultError } from "typhoon-core/error";
import { GoogleSheetsError } from "../../schemas/google";
import { ParserFieldError } from "../../schemas/sheet/error";
import { SheetConfigError } from "../../schemas/sheetConfig";
import {
  PlayerDayScheduleResponse,
  PopulatedScheduleResponse,
  ScheduleView,
} from "../../schemas/sheet";
import { SheetAuthTokenAuthorization } from "../../middlewares/sheetAuthTokenAuthorization/tag";

const ScheduleError = [
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  SchemaError,
  QueryResultError,
];

const ScheduleViewUrlParam = Schema.optional(ScheduleView);

export class ScheduleApi extends HttpApiGroup.make("schedule")
  .add(
    HttpApiEndpoint.get("getAllPopulatedSchedules", "/schedule/getAllPopulatedSchedules", {
      query: Schema.Struct({ guildId: Schema.String, view: ScheduleViewUrlParam }),
      success: PopulatedScheduleResponse,
      error: ScheduleError,
    }),
  )
  .add(
    HttpApiEndpoint.get("getDayPopulatedSchedules", "/schedule/getDayPopulatedSchedules", {
      query: Schema.Struct({
        guildId: Schema.String,
        day: Schema.NumberFromString,
        view: ScheduleViewUrlParam,
      }),
      success: PopulatedScheduleResponse,
      error: ScheduleError,
    }),
  )
  .add(
    HttpApiEndpoint.get("getChannelPopulatedSchedules", "/schedule/getChannelPopulatedSchedules", {
      query: Schema.Struct({
        guildId: Schema.String,
        channel: Schema.String,
        view: ScheduleViewUrlParam,
      }),
      success: PopulatedScheduleResponse,
      error: ScheduleError,
    }),
  )
  .add(
    HttpApiEndpoint.get("getDayPlayerSchedule", "/schedule/getDayPlayerSchedule", {
      query: Schema.Struct({
        guildId: Schema.String,
        day: Schema.NumberFromString,
        accountId: Schema.String,
        view: ScheduleViewUrlParam,
      }),
      success: PlayerDayScheduleResponse,
      error: ScheduleError,
    }),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Schedule")
  .annotate(OpenApi.Description, "Populated schedule data endpoints") {}
