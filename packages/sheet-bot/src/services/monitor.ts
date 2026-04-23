import { Effect, Layer, Context } from "effect";
import { SheetApisClient } from "./sheetApis";

export class Monitor extends Context.Service<Monitor>()("Monitor", {
  make: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;

    return {
      getMonitorMaps: Effect.fn("Monitor.getMonitorMaps")(function* (guildId: string) {
        return yield* sheetApisClient.get().monitor.getMonitorMaps({ query: { guildId } });
      }),
      getMonitorById: Effect.fn("Monitor.getMonitorById")(function* (
        guildId: string,
        ids: ReadonlyArray<string>,
      ) {
        return yield* sheetApisClient.get().monitor.getByIds({ query: { guildId, ids } });
      }),
      getMonitorByName: Effect.fn("Monitor.getMonitorByName")(function* (
        guildId: string,
        names: ReadonlyArray<string>,
      ) {
        return yield* sheetApisClient.get().monitor.getByNames({ query: { guildId, names } });
      }),
    };
  }),
}) {
  static layer = Layer.effect(Monitor, this.make).pipe(Layer.provide(SheetApisClient.layer));
}
