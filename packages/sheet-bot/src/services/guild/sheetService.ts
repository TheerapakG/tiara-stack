import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { SheetApisClient } from "@/client/sheetApis";
import { GuildService } from "./guildService";
import { UntilObserver } from "typhoon-core/signal";

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
        rangesConfig: Effect.cached(
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "sheetConfig.getRangesConfig",
                { guildId },
              ),
            ),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.withSpan("SheetService.rangesConfig", {
              captureStackTrace: true,
            }),
          ),
        ),
        teamConfig: Effect.cached(
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "sheetConfig.getTeamConfig",
                { guildId },
              ),
            ),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.withSpan("SheetService.teamConfig", {
              captureStackTrace: true,
            }),
          ),
        ),
        eventConfig: Effect.cached(
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "sheetConfig.getEventConfig",
                { guildId },
              ),
            ),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.withSpan("SheetService.eventConfig", {
              captureStackTrace: true,
            }),
          ),
        ),
        scheduleConfig: Effect.cached(
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "sheetConfig.getScheduleConfig",
                { guildId },
              ),
            ),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.withSpan("SheetService.scheduleConfig", {
              captureStackTrace: true,
            }),
          ),
        ),
        runnerConfig: Effect.cached(
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "sheetConfig.getRunnerConfig",
                { guildId },
              ),
            ),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.withSpan("SheetService.runnerConfig", {
              captureStackTrace: true,
            }),
          ),
        ),
        players: Effect.cached(
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "sheet.getPlayers",
                { guildId },
              ),
            ),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.withSpan("SheetService.players", {
              captureStackTrace: true,
            }),
          ),
        ),
        teams: Effect.cached(
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
        ),
        allSchedules: Effect.cached(
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "sheet.getAllSchedules",
                { guildId },
              ),
            ),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.withSpan("SheetService.allSchedules", {
              captureStackTrace: true,
            }),
          ),
        ),
        daySchedules: Effect.cachedFunction((day: number) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "sheet.getDaySchedules",
                { guildId, day },
              ),
            ),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.withSpan("SheetService.daySchedules", {
              captureStackTrace: true,
            }),
          ),
        ),
        channelSchedules: Effect.cachedFunction((channel: string) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "sheet.getChannelSchedules",
                { guildId, channel },
              ),
            ),
            UntilObserver.observeUntilRpcResultResolved(),
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
  },
) {}
