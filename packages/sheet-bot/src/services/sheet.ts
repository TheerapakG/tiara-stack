import { Data, Effect, pipe } from "effect";
import { ScopedCache } from "typhoon-core/utils";
import { SheetApisClient } from "./sheetApis";

export class SheetService extends Effect.Service<SheetService>()("SheetService", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      getRangesConfig: Effect.fn("Sheet.getRangesConfig")((guildId: string) =>
        sheetApisClient.get().sheet.getRangesConfig({ urlParams: { guildId } }),
      ),
      getTeamConfig: Effect.fn("Sheet.getTeamConfig")((guildId: string) =>
        sheetApisClient.get().sheet.getTeamConfig({ urlParams: { guildId } }),
      ),
      getMonitors: Effect.fn("Sheet.getMonitors")((guildId: string) =>
        sheetApisClient.get().sheet.getMonitors({ urlParams: { guildId } }),
      ),
      getEventConfig: Effect.fn("Sheet.getEventConfig")((guildId: string) =>
        sheetApisClient.get().sheet.getEventConfig({ urlParams: { guildId } }),
      ),
      getScheduleConfig: Effect.fn("Sheet.getScheduleConfig")((guildId: string) =>
        sheetApisClient.get().sheet.getScheduleConfig({ urlParams: { guildId } }),
      ),
      getRunnerConfig: Effect.fn("Sheet.getRunnerConfig")((guildId: string) =>
        sheetApisClient.get().sheet.getRunnerConfig({ urlParams: { guildId } }),
      ),
      getPlayers: Effect.fn("Sheet.getPlayers")((guildId: string) =>
        sheetApisClient.get().sheet.getPlayers({ urlParams: { guildId } }),
      ),
      getTeams: Effect.fn("Sheet.getTeams")((guildId: string) =>
        sheetApisClient.get().sheet.getTeams({ urlParams: { guildId } }),
      ),
      getAllSchedules: Effect.fn("Sheet.getAllSchedules")((guildId: string) =>
        sheetApisClient.get().sheet.getAllSchedules({ urlParams: { guildId } }),
      ),
      getDaySchedules: Effect.fn("Sheet.getDaySchedules")((guildId: string, day: number) =>
        sheetApisClient.get().sheet.getDaySchedules({ urlParams: { guildId, day } }),
      ),
      getChannelSchedules: Effect.fn("Sheet.getChannelSchedules")(
        (guildId: string, channel: string) =>
          sheetApisClient.get().sheet.getChannelSchedules({ urlParams: { guildId, channel } }),
      ),
    })),
    Effect.flatMap((sheetMethods) =>
      Effect.all({
        getRangesConfigCache: ScopedCache.make({
          lookup: sheetMethods.getRangesConfig,
        }),
        getTeamConfigCache: ScopedCache.make({
          lookup: sheetMethods.getTeamConfig,
        }),
        getMonitorsCache: ScopedCache.make({
          lookup: sheetMethods.getMonitors,
        }),
        getEventConfigCache: ScopedCache.make({
          lookup: sheetMethods.getEventConfig,
        }),
        getScheduleConfigCache: ScopedCache.make({
          lookup: sheetMethods.getScheduleConfig,
        }),
        getRunnerConfigCache: ScopedCache.make({
          lookup: sheetMethods.getRunnerConfig,
        }),
        getPlayersCache: ScopedCache.make({
          lookup: sheetMethods.getPlayers,
        }),
        getTeamsCache: ScopedCache.make({
          lookup: sheetMethods.getTeams,
        }),
        getAllSchedulesCache: ScopedCache.make({
          lookup: sheetMethods.getAllSchedules,
        }),
        getDaySchedulesCache: ScopedCache.make({
          lookup: ({ guildId, day }: { guildId: string; day: number }) =>
            sheetMethods.getDaySchedules(guildId, day),
        }),
        getChannelSchedulesCache: ScopedCache.make({
          lookup: ({ guildId, channel }: { guildId: string; channel: string }) =>
            sheetMethods.getChannelSchedules(guildId, channel),
        }),
      }),
    ),
    Effect.map((caches) => ({
      getRangesConfig: (guildId: string) => caches.getRangesConfigCache.get(guildId),
      getTeamConfig: (guildId: string) => caches.getTeamConfigCache.get(guildId),
      getMonitors: (guildId: string) => caches.getMonitorsCache.get(guildId),
      getEventConfig: (guildId: string) => caches.getEventConfigCache.get(guildId),
      getScheduleConfig: (guildId: string) => caches.getScheduleConfigCache.get(guildId),
      getRunnerConfig: (guildId: string) => caches.getRunnerConfigCache.get(guildId),
      getPlayers: (guildId: string) => caches.getPlayersCache.get(guildId),
      getTeams: (guildId: string) => caches.getTeamsCache.get(guildId),
      getAllSchedules: (guildId: string) => caches.getAllSchedulesCache.get(guildId),
      getDaySchedules: (guildId: string, day: number) =>
        caches.getDaySchedulesCache.get(Data.struct({ guildId, day })),
      getChannelSchedules: (guildId: string, channel: string) =>
        caches.getChannelSchedulesCache.get(Data.struct({ guildId, channel })),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
