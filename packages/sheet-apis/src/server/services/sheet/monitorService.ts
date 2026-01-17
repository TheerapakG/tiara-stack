import { Array, Effect, Function, HashMap, Option, pipe } from "effect";
import { Array as ArrayUtils } from "typhoon-core/utils";
import { SheetService } from "./sheetService";
import { Monitor, PartialIdMonitor, PartialNameMonitor } from "@/server/schema";
import { SignalContext } from "typhoon-core/signal";
import { upperFirst } from "scule";

export class MonitorService extends Effect.Service<MonitorService>()("MonitorService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("sheetService", () => SheetService),
    Effect.bindAll(({ sheetService }) => ({
      monitorMaps: Effect.cached(
        pipe(
          sheetService.getMonitors(),
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
                globalThis.Array.from(groups).map(([name, monitors]) => [name, { name, monitors }]),
              ),
            );

            return {
              idToMonitor,
              nameToMonitor,
            };
          }),
          Effect.withSpan("MonitorService.monitorMaps", {
            captureStackTrace: true,
          }),
        ),
      ),
    })),
    Effect.map(({ monitorMaps }) => ({
      getMonitorMaps: () =>
        pipe(
          monitorMaps,
          Effect.withSpan("MonitorService.getMonitorMaps", {
            captureStackTrace: true,
          }),
        ),
      _getByIds: <E = never>(ids: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
        pipe(
          Effect.all({
            ids: SignalContext.getMaybeSignalEffectValue(ids),
            monitorMaps,
          }),
          Effect.map(({ ids, monitorMaps: { idToMonitor } }) =>
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
      _getByNames: <E = never>(names: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
        pipe(
          Effect.all({
            names: SignalContext.getMaybeSignalEffectValue(names),
            monitorMaps,
          }),
          Effect.map(({ names, monitorMaps: { nameToMonitor } }) =>
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
  ),
  dependencies: [SheetService.DefaultWithoutDependencies],
  accessors: true,
}) {
  static getMonitorMaps = () => MonitorService.use(({ getMonitorMaps }) => getMonitorMaps());

  static getByIds = <E = never>(ids: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
    MonitorService.use(({ _getByIds }) => _getByIds(ids));

  static getByNames = <E = never>(names: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
    MonitorService.use(({ _getByNames }) => _getByNames(names));
}
