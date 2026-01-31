import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
import { SheetApisClient } from "@/client/sheetApis";
import { GuildService } from "./guildService";

export class SheetService extends Effect.Service<SheetService>()("SheetService", {
  effect: pipe(
    Effect.Do,
    bindObject({
      guildService: GuildService,
      sheetApisClient: SheetApisClient,
    }),
    Effect.bindAll(({ guildService, sheetApisClient }) => ({
      rangesConfig: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getRangesConfig({ urlParams: { guildId } }),
          ),
          Effect.withSpan("SheetService.rangesConfig", {
            captureStackTrace: true,
          }),
        ),
      ),
      teamConfig: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getTeamConfig({ urlParams: { guildId } }),
          ),
          Effect.withSpan("SheetService.teamConfig", {
            captureStackTrace: true,
          }),
        ),
      ),
      monitors: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getMonitors({ urlParams: { guildId } }),
          ),
          Effect.withSpan("SheetService.monitors", {
            captureStackTrace: true,
          }),
        ),
      ),
      eventConfig: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getEventConfig({ urlParams: { guildId } }),
          ),
          Effect.withSpan("SheetService.eventConfig", {
            captureStackTrace: true,
          }),
        ),
      ),
      scheduleConfig: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getScheduleConfig({ urlParams: { guildId } }),
          ),
          Effect.withSpan("SheetService.scheduleConfig", {
            captureStackTrace: true,
          }),
        ),
      ),
      runnerConfig: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getRunnerConfig({ urlParams: { guildId } }),
          ),
          Effect.withSpan("SheetService.runnerConfig", {
            captureStackTrace: true,
          }),
        ),
      ),
      players: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getPlayers({ urlParams: { guildId } }),
          ),
          Effect.withSpan("SheetService.players", {
            captureStackTrace: true,
          }),
        ),
      ),
      teams: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getTeams({ urlParams: { guildId } }),
          ),
          Effect.withSpan("SheetService.teams", {
            captureStackTrace: true,
          }),
        ),
      ),
      allSchedules: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getAllSchedules({ urlParams: { guildId } }),
          ),
          Effect.withSpan("SheetService.allSchedules", {
            captureStackTrace: true,
          }),
        ),
      ),
      daySchedules: Effect.cachedFunction((day: number) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getDaySchedules({ urlParams: { guildId, day } }),
          ),
          Effect.withSpan("SheetService.daySchedules", {
            captureStackTrace: true,
          }),
        ),
      ),
      channelSchedules: Effect.cachedFunction((channel: string) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().sheet.getChannelSchedules({ urlParams: { guildId, channel } }),
          ),
          Effect.withSpan("SheetService.channelSchedules", {
            captureStackTrace: true,
          }),
        ),
      ),
    })),
    Effect.map(
      ({
        rangesConfig,
        teamConfig,
        monitors,
        eventConfig,
        scheduleConfig,
        runnerConfig,
        players,
        teams,
        allSchedules,
        daySchedules,
        channelSchedules,
      }) => ({
        rangesConfig: () => rangesConfig,
        teamConfig: () => teamConfig,
        monitors: () => monitors,
        eventConfig: () => eventConfig,
        scheduleConfig: () => scheduleConfig,
        runnerConfig: () => runnerConfig,
        players: () => players,
        teams: () => teams,
        allSchedules: () => allSchedules,
        daySchedules: daySchedules,
        channelSchedules: channelSchedules,
      }),
    ),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
