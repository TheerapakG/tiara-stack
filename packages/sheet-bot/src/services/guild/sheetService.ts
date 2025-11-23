import { bindObject } from "@/utils";
import { Effect, pipe, ScopedCache, Duration } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { SheetApisClient } from "@/client/sheetApis";
import { GuildService } from "./guildService";

export class SheetService extends Effect.Service<SheetService>()(
  "SheetService",
  {
    effect: pipe(
      Effect.Do,
      bindObject({
        guildService: GuildService,
        sheetApisClient: SheetApisClient,
      }),
      Effect.bindAll(({ guildService, sheetApisClient }) => ({
        rangesConfig: ScopedCache.make({
          lookup: () =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheetConfig.getRangesConfig",
                  { guildId },
                ),
              ),
              Effect.withSpan("SheetService.rangesConfig", {
                captureStackTrace: true,
              }),
            ),
          capacity: 1,
          timeToLive: Duration.infinity,
        }),
        teamConfig: ScopedCache.make({
          lookup: () =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheetConfig.getTeamConfig",
                  { guildId },
                ),
              ),
              Effect.withSpan("SheetService.teamConfig", {
                captureStackTrace: true,
              }),
            ),
          capacity: 1,
          timeToLive: Duration.infinity,
        }),
        eventConfig: ScopedCache.make({
          lookup: () =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheetConfig.getEventConfig",
                  { guildId },
                ),
              ),
              Effect.withSpan("SheetService.eventConfig", {
                captureStackTrace: true,
              }),
            ),
          capacity: 1,
          timeToLive: Duration.infinity,
        }),
        scheduleConfig: ScopedCache.make({
          lookup: () =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheetConfig.getScheduleConfig",
                  { guildId },
                ),
              ),
              Effect.withSpan("SheetService.scheduleConfig", {
                captureStackTrace: true,
              }),
            ),
          capacity: 1,
          timeToLive: Duration.infinity,
        }),
        runnerConfig: ScopedCache.make({
          lookup: () =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheetConfig.getRunnerConfig",
                  { guildId },
                ),
              ),
              Effect.withSpan("SheetService.runnerConfig", {
                captureStackTrace: true,
              }),
            ),
          capacity: 1,
          timeToLive: Duration.infinity,
        }),
        players: ScopedCache.make({
          lookup: () =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheet.getPlayers",
                  { guildId },
                ),
              ),
              Effect.withSpan("SheetService.players", {
                captureStackTrace: true,
              }),
            ),
          capacity: 1,
          timeToLive: Duration.infinity,
        }),
        teams: ScopedCache.make({
          lookup: () =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheet.getTeams",
                  { guildId },
                ),
              ),
              Effect.withSpan("SheetService.teams", {
                captureStackTrace: true,
              }),
            ),
          capacity: 1,
          timeToLive: Duration.infinity,
        }),
        allSchedules: ScopedCache.make({
          lookup: () =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheet.getAllSchedules",
                  { guildId },
                ),
              ),
              Effect.withSpan("SheetService.allSchedules", {
                captureStackTrace: true,
              }),
            ),
          capacity: 1,
          timeToLive: Duration.infinity,
        }),
        daySchedules: ScopedCache.make({
          lookup: (day: number) =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheet.getDaySchedules",
                  { guildId, day },
                ),
              ),
              Effect.withSpan("SheetService.daySchedules", {
                captureStackTrace: true,
              }),
            ),
          capacity: 16,
          timeToLive: Duration.infinity,
        }),
        channelSchedules: ScopedCache.make({
          lookup: (channel: string) =>
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "sheet.getChannelSchedules",
                  { guildId, channel },
                ),
              ),
            ),
          capacity: 16,
          timeToLive: Duration.infinity,
        }),
      })),
      Effect.map(
        ({
          rangesConfig,
          teamConfig,
          eventConfig,
          scheduleConfig,
          runnerConfig,
          players,
          teams,
          allSchedules,
          daySchedules,
          channelSchedules,
        }) => ({
          rangesConfig: rangesConfig.get(undefined),
          teamConfig: teamConfig.get(undefined),
          eventConfig: eventConfig.get(undefined),
          scheduleConfig: scheduleConfig.get(undefined),
          runnerConfig: runnerConfig.get(undefined),
          players: players.get(undefined),
          teams: teams.get(undefined),
          allSchedules: allSchedules.get(undefined),
          daySchedules: (day: number) => daySchedules.get(day),
          channelSchedules: (channel: string) => channelSchedules.get(channel),
        }),
      ),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
