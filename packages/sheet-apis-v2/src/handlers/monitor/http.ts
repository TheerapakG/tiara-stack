import { HttpApiBuilder } from "@effect/platform";
import { Effect, HashMap, Layer, pipe } from "effect";
import { Api } from "@/api";
import { MonitorService } from "@/services/monitor";

export const MonitorLive = HttpApiBuilder.group(Api, "monitor", (handlers) =>
  pipe(
    Effect.all({
      monitorService: MonitorService,
    }),
    Effect.map(({ monitorService }) =>
      handlers
        .handle("getMonitorMaps", () =>
          pipe(
            monitorService.getMonitorMaps(),
            Effect.map((monitorMaps) => ({
              idToMonitor: Array.from(HashMap.entries(monitorMaps.idToMonitor)).map(
                ([key, value]) => ({
                  key,
                  value: Array.from(value),
                }),
              ),
              nameToMonitor: Array.from(HashMap.entries(monitorMaps.nameToMonitor)).map(
                ([key, value]) => ({
                  key,
                  value: { name: value.name, monitors: Array.from(value.monitors) },
                }),
              ),
            })),
          ),
        )
        .handle("getByIds", ({ urlParams }) =>
          monitorService.getByIds(urlParams.sheetId, urlParams.ids),
        )
        .handle("getByNames", ({ urlParams }) =>
          monitorService.getByNames(urlParams.sheetId, urlParams.names),
        ),
    ),
  ),
).pipe(Layer.provide(MonitorService.Default));
