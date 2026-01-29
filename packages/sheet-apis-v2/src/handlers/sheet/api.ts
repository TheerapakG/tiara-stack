import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import { RawPlayer, RawMonitor, Team, BreakSchedule, Schedule } from "@/schemas/sheet";

const SheetError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
);

export class SheetApi extends HttpApiGroup.make("sheet")
  .add(
    HttpApiEndpoint.get("getPlayers", "/sheet/getPlayers")
      .setUrlParams(Schema.Struct({ sheetId: Schema.String }))
      .addSuccess(Schema.Array(RawPlayer))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getMonitors", "/sheet/getMonitors")
      .setUrlParams(Schema.Struct({ sheetId: Schema.String }))
      .addSuccess(Schema.Array(RawMonitor))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getTeams", "/sheet/getTeams")
      .setUrlParams(Schema.Struct({ sheetId: Schema.String }))
      .addSuccess(Schema.Array(Team))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getAllSchedules", "/sheet/getAllSchedules")
      .setUrlParams(Schema.Struct({ sheetId: Schema.String }))
      .addSuccess(Schema.Array(Schema.Union(BreakSchedule, Schedule)))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getDaySchedules", "/sheet/getDaySchedules")
      .setUrlParams(Schema.Struct({ sheetId: Schema.String, day: Schema.NumberFromString }))
      .addSuccess(Schema.Array(Schema.Union(BreakSchedule, Schedule)))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getChannelSchedules", "/sheet/getChannelSchedules")
      .setUrlParams(Schema.Struct({ sheetId: Schema.String, channel: Schema.String }))
      .addSuccess(Schema.Array(Schema.Union(BreakSchedule, Schedule)))
      .addError(SheetError),
  )
  .annotate(OpenApi.Title, "Sheet")
  .annotate(OpenApi.Description, "Sheet data endpoints") {}
