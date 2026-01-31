import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { ValidationError, QueryResultError } from "typhoon-core/error";
import { GoogleSheetsError } from "@/schemas/google";
import { ParserFieldError } from "@/schemas/sheet/error";
import { SheetConfigError } from "@/schemas/sheetConfig";
import { Monitor, PartialIdMonitor, PartialNameMonitor } from "@/schemas/sheet";

const MonitorError = Schema.Union(
  GoogleSheetsError,
  ParserFieldError,
  SheetConfigError,
  ValidationError,
  QueryResultError,
);

export class MonitorApi extends HttpApiGroup.make("monitor")
  .add(
    HttpApiEndpoint.get("getMonitorMaps", "/monitor/getMonitorMaps")
      .setUrlParams(Schema.Struct({ guildId: Schema.String }))
      .addSuccess(
        Schema.Struct({
          idToMonitor: Schema.Array(
            Schema.Struct({
              key: Schema.String,
              value: Schema.Array(Monitor),
            }),
          ),
          nameToMonitor: Schema.Array(
            Schema.Struct({
              key: Schema.String,
              value: Schema.Struct({
                name: Schema.String,
                monitors: Schema.Array(Monitor),
              }),
            }),
          ),
        }),
      )
      .addError(MonitorError),
  )
  .add(
    HttpApiEndpoint.get("getByIds", "/monitor/getByIds")
      .setUrlParams(Schema.Struct({ guildId: Schema.String, ids: Schema.Array(Schema.String) }))
      .addSuccess(Schema.Array(Schema.Array(Schema.Union(Monitor, PartialIdMonitor))))
      .addError(MonitorError),
  )
  .add(
    HttpApiEndpoint.get("getByNames", "/monitor/getByNames")
      .setUrlParams(Schema.Struct({ guildId: Schema.String, names: Schema.Array(Schema.String) }))
      .addSuccess(Schema.Array(Schema.Array(Schema.Union(Monitor, PartialNameMonitor))))
      .addError(MonitorError),
  )
  .annotate(OpenApi.Title, "Monitor")
  .annotate(OpenApi.Description, "Monitor data endpoints") {}
