import { Effect, HashMap, Layer, Option, Context, pipe } from "effect";
import { SheetService } from "./sheet";
import { Monitor, PartialIdMonitor, PartialNameMonitor } from "@/schemas/sheet";
import { upperFirst } from "scule";
import { ScopedCache } from "typhoon-core/utils";

type MonitorMaps = {
  idToMonitor: HashMap.HashMap<string, [Monitor, ...Monitor[]]>;
  nameToMonitor: HashMap.HashMap<string, { name: string; monitors: ReadonlyArray<Monitor> }>;
};

export class MonitorService extends Context.Service<MonitorService>()("MonitorService", {
  make: Effect.gen(function* () {
    const sheetService = yield* SheetService;

    const getMonitorMaps = Effect.fn("MonitorService.getMonitorMaps")(function* (sheetId: string) {
      const rawMonitors = yield* sheetService.getMonitors(sheetId);
      const monitors: Monitor[] = [];

      for (const monitor of rawMonitors) {
        if (Option.isSome(monitor.id) && Option.isSome(monitor.name)) {
          monitors.push(
            new Monitor({
              index: monitor.index,
              id: monitor.id.value,
              name: monitor.name.value,
            }),
          );
        }
      }

      const idGroups = new Map<string, [Monitor, ...Monitor[]]>();
      const nameGroups = new Map<string, Monitor[]>();

      for (const monitor of monitors) {
        const existingById = idGroups.get(monitor.id);
        if (existingById) {
          existingById.push(monitor);
        } else {
          idGroups.set(monitor.id, [monitor]);
        }

        const existingByName = nameGroups.get(monitor.name);
        if (existingByName) {
          existingByName.push(monitor);
        } else {
          nameGroups.set(monitor.name, [monitor]);
        }
      }

      return yield* Effect.succeed({
        idToMonitor: HashMap.fromIterable(idGroups),
        nameToMonitor: HashMap.fromIterable(
          globalThis.Array.from(nameGroups, ([name, groupedMonitors]) => [
            name,
            { name, monitors: groupedMonitors },
          ]),
        ),
      } satisfies MonitorMaps).pipe(Effect.withSpan("MonitorService.getMonitorMaps"));
    });

    const getByIds = Effect.fn("MonitorService.getByIds")(function* (
      sheetId: string,
      ids: readonly string[],
    ) {
      const { idToMonitor } = yield* getMonitorMaps(sheetId);
      return yield* Effect.succeed(
        ids.map((id) =>
          pipe(
            HashMap.get(idToMonitor, id),
            Option.getOrElse(() => [new PartialIdMonitor({ id })] as const),
          ),
        ),
      ).pipe(Effect.withSpan("MonitorService.getByIds"));
    });

    const getByNames = Effect.fn("MonitorService.getByNames")(function* (
      sheetId: string,
      names: readonly string[],
    ) {
      const { nameToMonitor } = yield* getMonitorMaps(sheetId);
      return yield* Effect.succeed(
        names.map((name) => {
          const normalizedName = upperFirst(name);
          return pipe(
            HashMap.get(nameToMonitor, normalizedName),
            Option.map((entry) => entry.monitors),
            Option.getOrElse(() => [new PartialNameMonitor({ name: normalizedName })] as const),
          );
        }),
      ).pipe(Effect.withSpan("MonitorService.getByNames"));
    });

    const getMonitorMapsCache = yield* ScopedCache.make({ lookup: getMonitorMaps });
    const getByIdsCache = yield* ScopedCache.make({
      lookup: ({ sheetId, ids }: { sheetId: string; ids: readonly string[] }) =>
        getByIds(sheetId, ids),
    });
    const getByNamesCache = yield* ScopedCache.make({
      lookup: ({ sheetId, names }: { sheetId: string; names: readonly string[] }) =>
        getByNames(sheetId, names),
    });

    return {
      getMonitorMaps: (sheetId: string) => getMonitorMapsCache.get(sheetId),
      getByIds: (sheetId: string, ids: readonly string[]) => getByIdsCache.get({ sheetId, ids }),
      getByNames: (sheetId: string, names: readonly string[]) =>
        getByNamesCache.get({ sheetId, names }),
    };
  }),
}) {
  static layer = Layer.effect(MonitorService, this.make).pipe(Layer.provide(SheetService.layer));
}
