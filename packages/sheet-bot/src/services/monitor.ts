import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class Monitor extends Effect.Service<Monitor>()("Monitor", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      getMonitorMaps: Effect.fn("Monitor.getMonitorMaps")((guildId: string) =>
        sheetApisClient.get().monitor.getMonitorMaps({ urlParams: { guildId } }),
      ),
      getMonitorById: Effect.fn("Monitor.getMonitorById")(
        (guildId: string, ids: ReadonlyArray<string>) =>
          sheetApisClient.get().monitor.getByIds({ urlParams: { guildId, ids } }),
      ),
      getMonitorByName: Effect.fn("Monitor.getMonitorByName")(
        (guildId: string, names: ReadonlyArray<string>) =>
          sheetApisClient.get().monitor.getByNames({ urlParams: { guildId, names } }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
