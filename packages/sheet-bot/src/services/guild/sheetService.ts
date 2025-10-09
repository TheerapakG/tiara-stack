import { bindObject } from "@/utils";
import { Effect, Number, pipe, String } from "effect";
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
      Effect.bindAll(
        ({ guildService, sheetApisClient }) => ({
          rangesConfig: Effect.cached(
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.once(
                  sheetApisClient.get(),
                  "sheetConfig.getRangesConfig",
                  { guildId },
                ),
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
                WebSocketClient.once(
                  sheetApisClient.get(),
                  "sheetConfig.getTeamConfig",
                  { guildId },
                ),
              ),
              Effect.withSpan("SheetService.teamConfig", {
                captureStackTrace: true,
              }),
            ),
          ),
          eventConfig: Effect.cached(
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.once(
                  sheetApisClient.get(),
                  "sheetConfig.getEventConfig",
                  { guildId },
                ),
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
                WebSocketClient.once(
                  sheetApisClient.get(),
                  "sheetConfig.getScheduleConfig",
                  { guildId },
                ),
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
                WebSocketClient.once(
                  sheetApisClient.get(),
                  "sheetConfig.getRunnerConfig",
                  { guildId },
                ),
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
                WebSocketClient.once(
                  sheetApisClient.get(),
                  "sheet.getPlayers",
                  { guildId },
                ),
              ),
            ),
          ),
          teams: Effect.cached(
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.once(sheetApisClient.get(), "sheet.getTeams", {
                  guildId,
                }),
              ),
            ),
          ),
          allSchedules: Effect.cached(
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.once(
                  sheetApisClient.get(),
                  "sheet.getAllSchedules",
                  { guildId },
                ),
              ),
            ),
          ),
          daySchedules: Effect.cachedFunction(
            (day: number) =>
              pipe(
                guildService.getId(),
                Effect.flatMap((guildId) =>
                  WebSocketClient.once(
                    sheetApisClient.get(),
                    "sheet.getDaySchedules",
                    { guildId, day },
                  ),
                ),
              ),
            Number.Equivalence,
          ),
          channelSchedules: Effect.cachedFunction(
            (channel: string) =>
              pipe(
                guildService.getId(),
                Effect.flatMap((guildId) =>
                  WebSocketClient.once(
                    sheetApisClient.get(),
                    "sheet.getChannelSchedules",
                    { guildId, channel },
                  ),
                ),
              ),
            String.Equivalence,
          ),
        }),
        { concurrency: "unbounded" },
      ),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
