import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import {
  EventConfig,
  RangesConfig,
  RunnerConfig,
  ScheduleConfig,
  TeamConfig,
} from "@/schemas/sheetConfig";
import { RawPlayer, RawMonitor, Team, BreakSchedule, Schedule } from "@/schemas/sheet";
import { KubernetesTokenAuthorization } from "@/middlewares/kubernetesTokenAuthorization/tag";

const SheetError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
);

export class SheetApi extends HttpApiGroup.make("sheet")
  .add(
    HttpApiEndpoint.get("getPlayers", "/sheet/getPlayers")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(Schema.Array(RawPlayer))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getMonitors", "/sheet/getMonitors")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(Schema.Array(RawMonitor))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getTeams", "/sheet/getTeams")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(Schema.Array(Team))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getAllSchedules", "/sheet/getAllSchedules")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(Schema.Array(Schema.Union(BreakSchedule, Schedule)))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getDaySchedules", "/sheet/getDaySchedules")
      .setUrlParams(Schema.Struct({ guildId: Schema.String, day: Schema.NumberFromString }))
      .addSuccess(Schema.Array(Schema.Union(BreakSchedule, Schedule)))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getChannelSchedules", "/sheet/getChannelSchedules")
      .setUrlParams(Schema.Struct({ guildId: Schema.String, channel: Schema.String }))
      .addSuccess(Schema.Array(Schema.Union(BreakSchedule, Schedule)))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getRangesConfig", "/sheet/getRangesConfig")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(RangesConfig)
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getTeamConfig", "/sheet/getTeamConfig")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(Schema.Array(TeamConfig))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getEventConfig", "/sheet/getEventConfig")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(EventConfig)
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getScheduleConfig", "/sheet/getScheduleConfig")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(Schema.Array(ScheduleConfig))
      .addError(SheetError),
  )
  .add(
    HttpApiEndpoint.get("getRunnerConfig", "/sheet/getRunnerConfig")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(Schema.Array(RunnerConfig))
      .addError(SheetError),
  )
  .middleware(KubernetesTokenAuthorization)
  .annotate(OpenApi.Title, "Sheet")
  .annotate(OpenApi.Description, "Sheet data endpoints") {}
