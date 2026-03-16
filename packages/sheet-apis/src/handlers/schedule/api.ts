import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import { PopulatedScheduleResult } from "@/schemas/sheet";
import { SheetAuthTokenAuthorization } from "@/middlewares/sheetAuthTokenAuthorization/tag";
import { SheetAuthTokenGuildMonitorAuthorization } from "@/middlewares/sheetAuthTokenGuildMonitorAuthorization/tag";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";

const ScheduleError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
);

const ScheduleMonitorError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
  Unauthorized,
);

export class ScheduleApi extends HttpApiGroup.make("schedule")
  .add(
    HttpApiEndpoint.get(
      "getAllPopulatedFillerSchedules",
      "/schedule/getAllPopulatedFillerSchedules",
    )
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(Schema.Array(PopulatedScheduleResult))
      .addError(ScheduleError),
  )
  .add(
    HttpApiEndpoint.get(
      "getDayPopulatedFillerSchedules",
      "/schedule/getDayPopulatedFillerSchedules",
    )
      .setUrlParams(Schema.Struct({ guildId: Schema.String, day: Schema.NumberFromString }))
      .addSuccess(Schema.Array(PopulatedScheduleResult))
      .addError(ScheduleError),
  )
  .add(
    HttpApiEndpoint.get(
      "getChannelPopulatedFillerSchedules",
      "/schedule/getChannelPopulatedFillerSchedules",
    )
      .setUrlParams(Schema.Struct({ guildId: Schema.String, channel: Schema.String }))
      .addSuccess(Schema.Array(PopulatedScheduleResult))
      .addError(ScheduleError),
  )
  .middleware(SheetAuthTokenAuthorization)
  .annotate(OpenApi.Title, "Schedule")
  .annotate(OpenApi.Description, "Populated schedule data endpoints") {}

export class ScheduleMonitorApi extends HttpApiGroup.make("scheduleMonitor")
  .add(
    HttpApiEndpoint.get(
      "getAllPopulatedMonitorSchedules",
      "/schedule/getAllPopulatedMonitorSchedules",
    )
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(Schema.Array(PopulatedScheduleResult))
      .addError(ScheduleMonitorError),
  )
  .add(
    HttpApiEndpoint.get(
      "getDayPopulatedMonitorSchedules",
      "/schedule/getDayPopulatedMonitorSchedules",
    )
      .setUrlParams(Schema.Struct({ guildId: Schema.String, day: Schema.NumberFromString }))
      .addSuccess(Schema.Array(PopulatedScheduleResult))
      .addError(ScheduleMonitorError),
  )
  .add(
    HttpApiEndpoint.get(
      "getChannelPopulatedMonitorSchedules",
      "/schedule/getChannelPopulatedMonitorSchedules",
    )
      .setUrlParams(Schema.Struct({ guildId: Schema.String, channel: Schema.String }))
      .addSuccess(Schema.Array(PopulatedScheduleResult))
      .addError(ScheduleMonitorError),
  )
  .middleware(SheetAuthTokenGuildMonitorAuthorization)
  .annotate(OpenApi.Title, "Schedule Monitor")
  .annotate(OpenApi.Description, "Monitor-only populated schedule data endpoints") {}
