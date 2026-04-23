import { Data, Effect, Layer, Context } from "effect";
import { ScopedCache } from "typhoon-core/utils";
import { SheetApisClient } from "./sheetApis";

class GuildDayKey extends Data.Class<{ guildId: string; day: number }> {}
class GuildChannelKey extends Data.Class<{ guildId: string; channel: string }> {}

export class SheetService extends Context.Service<SheetService>()("SheetService", {
  make: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;

    const getRangesConfig = Effect.fn("Sheet.getRangesConfig")((guildId: string) =>
      sheetApisClient.get().sheet.getRangesConfig({ query: { guildId } }),
    );
    const getTeamConfig = Effect.fn("Sheet.getTeamConfig")((guildId: string) =>
      sheetApisClient.get().sheet.getTeamConfig({ query: { guildId } }),
    );
    const getMonitors = Effect.fn("Sheet.getMonitors")((guildId: string) =>
      sheetApisClient.get().sheet.getMonitors({ query: { guildId } }),
    );
    const getEventConfig = Effect.fn("Sheet.getEventConfig")((guildId: string) =>
      sheetApisClient.get().sheet.getEventConfig({ query: { guildId } }),
    );
    const getScheduleConfig = Effect.fn("Sheet.getScheduleConfig")((guildId: string) =>
      sheetApisClient.get().sheet.getScheduleConfig({ query: { guildId } }),
    );
    const getRunnerConfig = Effect.fn("Sheet.getRunnerConfig")((guildId: string) =>
      sheetApisClient.get().sheet.getRunnerConfig({ query: { guildId } }),
    );
    const getPlayers = Effect.fn("Sheet.getPlayers")((guildId: string) =>
      sheetApisClient.get().sheet.getPlayers({ query: { guildId } }),
    );
    const getTeams = Effect.fn("Sheet.getTeams")((guildId: string) =>
      sheetApisClient.get().sheet.getTeams({ query: { guildId } }),
    );
    const getAllFillerSchedules = Effect.fn("Sheet.getAllFillerSchedules")((guildId: string) =>
      sheetApisClient
        .get()
        .sheet.getAllSchedules({ query: { guildId, view: "filler" } })
        .pipe(Effect.map(({ schedules }) => schedules)),
    );
    const getDayFillerSchedules = Effect.fn("Sheet.getDayFillerSchedules")(
      (guildId: string, day: number) =>
        sheetApisClient
          .get()
          .sheet.getDaySchedules({ query: { guildId, day, view: "filler" } })
          .pipe(Effect.map(({ schedules }) => schedules)),
    );
    const getChannelFillerSchedules = Effect.fn("Sheet.getChannelFillerSchedules")(
      (guildId: string, channel: string) =>
        sheetApisClient
          .get()
          .sheet.getChannelSchedules({ query: { guildId, channel, view: "filler" } })
          .pipe(Effect.map(({ schedules }) => schedules)),
    );
    const getAllMonitorSchedules = Effect.fn("Sheet.getAllMonitorSchedules")((guildId: string) =>
      sheetApisClient
        .get()
        .sheet.getAllSchedules({ query: { guildId, view: "monitor" } })
        .pipe(Effect.map(({ schedules }) => schedules)),
    );
    const getDayMonitorSchedules = Effect.fn("Sheet.getDayMonitorSchedules")(
      (guildId: string, day: number) =>
        sheetApisClient
          .get()
          .sheet.getDaySchedules({ query: { guildId, day, view: "monitor" } })
          .pipe(Effect.map(({ schedules }) => schedules)),
    );
    const getChannelMonitorSchedules = Effect.fn("Sheet.getChannelMonitorSchedules")(
      (guildId: string, channel: string) =>
        sheetApisClient
          .get()
          .sheet.getChannelSchedules({ query: { guildId, channel, view: "monitor" } })
          .pipe(Effect.map(({ schedules }) => schedules)),
    );

    const caches = yield* Effect.all({
      getRangesConfigCache: ScopedCache.make({ lookup: getRangesConfig }),
      getTeamConfigCache: ScopedCache.make({ lookup: getTeamConfig }),
      getMonitorsCache: ScopedCache.make({ lookup: getMonitors }),
      getEventConfigCache: ScopedCache.make({ lookup: getEventConfig }),
      getScheduleConfigCache: ScopedCache.make({ lookup: getScheduleConfig }),
      getRunnerConfigCache: ScopedCache.make({ lookup: getRunnerConfig }),
      getPlayersCache: ScopedCache.make({ lookup: getPlayers }),
      getTeamsCache: ScopedCache.make({ lookup: getTeams }),
      getAllFillerSchedulesCache: ScopedCache.make({ lookup: getAllFillerSchedules }),
      getDayFillerSchedulesCache: ScopedCache.make({
        lookup: ({ guildId, day }: GuildDayKey) => getDayFillerSchedules(guildId, day),
      }),
      getChannelFillerSchedulesCache: ScopedCache.make({
        lookup: ({ guildId, channel }: GuildChannelKey) =>
          getChannelFillerSchedules(guildId, channel),
      }),
      getAllMonitorSchedulesCache: ScopedCache.make({ lookup: getAllMonitorSchedules }),
      getDayMonitorSchedulesCache: ScopedCache.make({
        lookup: ({ guildId, day }: GuildDayKey) => getDayMonitorSchedules(guildId, day),
      }),
      getChannelMonitorSchedulesCache: ScopedCache.make({
        lookup: ({ guildId, channel }: GuildChannelKey) =>
          getChannelMonitorSchedules(guildId, channel),
      }),
    });

    return {
      getRangesConfig: (guildId: string) => caches.getRangesConfigCache.get(guildId),
      getTeamConfig: (guildId: string) => caches.getTeamConfigCache.get(guildId),
      getMonitors: (guildId: string) => caches.getMonitorsCache.get(guildId),
      getEventConfig: (guildId: string) => caches.getEventConfigCache.get(guildId),
      getScheduleConfig: (guildId: string) => caches.getScheduleConfigCache.get(guildId),
      getRunnerConfig: (guildId: string) => caches.getRunnerConfigCache.get(guildId),
      getPlayers: (guildId: string) => caches.getPlayersCache.get(guildId),
      getTeams: (guildId: string) => caches.getTeamsCache.get(guildId),
      getAllFillerSchedules: (guildId: string) => caches.getAllFillerSchedulesCache.get(guildId),
      getDayFillerSchedules: (guildId: string, day: number) =>
        caches.getDayFillerSchedulesCache.get(new GuildDayKey({ guildId, day })),
      getChannelFillerSchedules: (guildId: string, channel: string) =>
        caches.getChannelFillerSchedulesCache.get(new GuildChannelKey({ guildId, channel })),
      getAllMonitorSchedules: (guildId: string) => caches.getAllMonitorSchedulesCache.get(guildId),
      getDayMonitorSchedules: (guildId: string, day: number) =>
        caches.getDayMonitorSchedulesCache.get(new GuildDayKey({ guildId, day })),
      getChannelMonitorSchedules: (guildId: string, channel: string) =>
        caches.getChannelMonitorSchedulesCache.get(new GuildChannelKey({ guildId, channel })),
    };
  }),
}) {
  static layer = Layer.effect(SheetService, this.make).pipe(Layer.provide(SheetApisClient.layer));
}
