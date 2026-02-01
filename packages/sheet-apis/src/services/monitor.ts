import { Array, Data, Effect, Function, HashMap, Option, pipe } from "effect";
import { Array as ArrayUtils } from "typhoon-core/utils";
import { SheetService } from "./sheet";
import { Monitor, PartialIdMonitor, PartialNameMonitor } from "@/schemas/sheet";
import { upperFirst } from "scule";
import { ScopedCache } from "typhoon-core/utils";

export class MonitorService extends Effect.Service<MonitorService>()("MonitorService", {
  scoped: pipe(
    Effect.Do,
    Effect.bind("sheetService", () => SheetService),
    Effect.let(
      "getMonitorMaps",
      ({ sheetService }) =>
        (sheetId: string) =>
          pipe(
            sheetService.getMonitors(sheetId),
            Effect.map(
              Array.filterMap((monitor) =>
                pipe(
                  Option.all({ id: monitor.id, name: monitor.name }),
                  Option.map(
                    ({ id, name }) =>
                      new Monitor({
                        index: monitor.index,
                        id,
                        name,
                      }),
                  ),
                ),
              ),
            ),
            Effect.map((monitors) => {
              const idToMonitor = pipe(monitors, ArrayUtils.Collect.toArrayHashMapByKey("id"));
              const nameGroups = pipe(monitors, ArrayUtils.Collect.toArrayHashMapByKey("name"));

              const nameToMonitor = pipe(nameGroups, (groups) =>
                HashMap.fromIterable<string, { name: string; monitors: ReadonlyArray<Monitor> }>(
                  globalThis.Array.from(groups).map(([name, monitors]) => [
                    name,
                    { name, monitors },
                  ]),
                ),
              );

              return {
                idToMonitor,
                nameToMonitor,
              };
            }),
            Effect.withSpan("MonitorService.getMonitorMaps", {
              captureStackTrace: true,
            }),
          ),
    ),
    Effect.map(({ getMonitorMaps }) => ({
      getMonitorMaps,
      getByIds: (sheetId: string, ids: readonly string[]) =>
        pipe(
          Effect.Do,
          Effect.bind("monitorMaps", () => getMonitorMaps(sheetId)),
          Effect.map(({ monitorMaps: { idToMonitor } }) =>
            Array.map(ids, (id) =>
              pipe(
                idToMonitor,
                HashMap.get(id),
                Option.getOrElse(() => Array.make(new PartialIdMonitor({ id }))),
                Array.map(Function.identity),
              ),
            ),
          ),
          Effect.withSpan("MonitorService.getByIds", {
            captureStackTrace: true,
          }),
        ),
      getByNames: (sheetId: string, names: readonly string[]) =>
        pipe(
          Effect.Do,
          Effect.bind("monitorMaps", () => getMonitorMaps(sheetId)),
          Effect.map(({ monitorMaps: { nameToMonitor } }) =>
            Array.map(names, (name) =>
              pipe(
                nameToMonitor,
                HashMap.get(upperFirst(name)),
                Option.map((entry) => entry.monitors),
                Option.getOrElse(() =>
                  Array.make(new PartialNameMonitor({ name: upperFirst(name) })),
                ),
                Array.map(Function.identity),
              ),
            ),
          ),
          Effect.withSpan("MonitorService.getByNames", {
            captureStackTrace: true,
          }),
        ),
    })),
    Effect.flatMap((monitorMethods) =>
      Effect.all({
        getMonitorMapsCache: ScopedCache.make({
          lookup: monitorMethods.getMonitorMaps,
        }),
        getByIdsCache: ScopedCache.make({
          lookup: ({ sheetId, ids }: { sheetId: string; ids: readonly string[] }) =>
            monitorMethods.getByIds(sheetId, ids),
        }),
        getByNamesCache: ScopedCache.make({
          lookup: ({ sheetId, names }: { sheetId: string; names: readonly string[] }) =>
            monitorMethods.getByNames(sheetId, names),
        }),
      }),
    ),
    Effect.map(({ getMonitorMapsCache, getByIdsCache, getByNamesCache }) => ({
      getMonitorMaps: (sheetId: string) => getMonitorMapsCache.get(sheetId),
      getByIds: (sheetId: string, ids: readonly string[]) =>
        getByIdsCache.get(Data.struct({ sheetId, ids })),
      getByNames: (sheetId: string, names: readonly string[]) =>
        getByNamesCache.get(Data.struct({ sheetId, names })),
    })),
  ),
  dependencies: [SheetService.Default],
  accessors: true,
}) {}
