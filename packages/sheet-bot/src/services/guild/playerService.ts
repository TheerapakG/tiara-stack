import { bindObject } from "@/utils";
import { Effect, pipe, Schema } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { SheetApisClient } from "@/client/sheetApis";
import { GuildService } from "./guildService";
import { Schema as SheetSchema } from "sheet-apis";
import { DefaultTaggedClass } from "typhoon-core/schema";

export class PlayerService extends Effect.Service<PlayerService>()(
  "PlayerService",
  {
    effect: pipe(
      Effect.Do,
      bindObject({
        guildService: GuildService,
        sheetApisClient: SheetApisClient,
      }),
      Effect.bindAll(
        ({ guildService, sheetApisClient }) => ({
          getPlayerMaps: Effect.cached(
            pipe(
              guildService.getId(),
              Effect.flatMap((guildId) =>
                WebSocketClient.once(
                  sheetApisClient.get(),
                  "player.getPlayerMaps",
                  { guildId },
                ),
              ),
              Effect.withSpan("PlayerService.getPlayerMaps", {
                captureStackTrace: true,
              }),
            ),
          ),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.map(({ guildService, sheetApisClient, getPlayerMaps }) => ({
        getPlayerMaps,
        getPlayerById: (ids: ReadonlyArray<string>) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.once(sheetApisClient.get(), "player.getById", {
                guildId,
                ids,
              }),
            ),
            Effect.withSpan("PlayerService.getPlayerById", {
              captureStackTrace: true,
            }),
          ),
        getPlayerByName: (names: ReadonlyArray<string>) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.once(sheetApisClient.get(), "player.getByName", {
                guildId,
                names,
              }),
            ),
            Effect.withSpan("PlayerService.getPlayerByName", {
              captureStackTrace: true,
            }),
          ),
        getTeamsById: (ids: ReadonlyArray<string>) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.once(
                sheetApisClient.get(),
                "player.getTeamsById",
                {
                  guildId,
                  ids,
                },
              ),
            ),
            Effect.withSpan("PlayerService.getTeamsById", {
              captureStackTrace: true,
            }),
          ),
        getTeamsByName: (names: ReadonlyArray<string>) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.once(
                sheetApisClient.get(),
                "player.getTeamsByName",
                { guildId, names },
              ),
            ),
            Effect.withSpan("PlayerService.getTeamsByName", {
              captureStackTrace: true,
            }),
          ),
        mapScheduleWithPlayers: (
          schedules: ReadonlyArray<
            SheetSchema.Schedule | SheetSchema.BreakSchedule
          >,
        ) =>
          pipe(
            Effect.Do,
            Effect.bindAll(
              () => ({
                guildId: guildService.getId(),
                schedules: pipe(
                  schedules,
                  Schema.encode(
                    Schema.Array(
                      Schema.Union(
                        DefaultTaggedClass(SheetSchema.Schedule),
                        DefaultTaggedClass(SheetSchema.BreakSchedule),
                      ),
                    ),
                  ),
                ),
              }),
              { concurrency: "unbounded" },
            ),
            Effect.flatMap(({ guildId, schedules }) =>
              WebSocketClient.once(
                sheetApisClient.get(),
                "player.mapScheduleWithPlayers",
                { guildId, schedules },
              ),
            ),
            Effect.withSpan("PlayerService.mapScheduleWithPlayers", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [SheetApisClient.Default],
    accessors: true,
  },
) {}
