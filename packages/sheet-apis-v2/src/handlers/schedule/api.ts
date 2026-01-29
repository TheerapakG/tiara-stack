import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import { PopulatedScheduleResult } from "@/schemas/sheet";

const ScheduleError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
);

export class ScheduleApi extends HttpApiGroup.make("schedule")
  .add(
    HttpApiEndpoint.get("getAllPopulatedSchedules", "/schedule/getAllPopulatedSchedules")
      .setUrlParams(Schema.Struct({ sheetId: Schema.String }))
      .addSuccess(Schema.Array(PopulatedScheduleResult))
      .addError(ScheduleError),
  )
  .add(
    HttpApiEndpoint.get("getDayPopulatedSchedules", "/schedule/getDayPopulatedSchedules")
      .setUrlParams(Schema.Struct({ sheetId: Schema.String, day: Schema.NumberFromString }))
      .addSuccess(Schema.Array(PopulatedScheduleResult))
      .addError(ScheduleError),
  )
  .add(
    HttpApiEndpoint.get("getChannelPopulatedSchedules", "/schedule/getChannelPopulatedSchedules")
      .setUrlParams(Schema.Struct({ sheetId: Schema.String, channel: Schema.String }))
      .addSuccess(Schema.Array(PopulatedScheduleResult))
      .addError(ScheduleError),
  )
  .annotate(OpenApi.Title, "Schedule")
  .annotate(OpenApi.Description, "Populated schedule data endpoints") {}
