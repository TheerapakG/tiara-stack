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
                WebSocketClient.subscribeScoped(
                  sheetApisClient.get(),
                  "player.getPlayerMaps",
                  { guildId },
                ),
              ),
              Effect.map(
                Effect.withSpan("PlayerService.getPlayerMaps subscription", {
                  captureStackTrace: true,
                }),
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
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "player.getById",
                {
                  guildId,
                  ids,
                },
              ),
            ),
            Effect.map(
              Effect.withSpan("PlayerService.getPlayerById subscription", {
                captureStackTrace: true,
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
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "player.getByName",
                {
                  guildId,
                  names,
                },
              ),
            ),
            Effect.map(
              Effect.withSpan("PlayerService.getPlayerByName subscription", {
                captureStackTrace: true,
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
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "player.getTeamsById",
                {
                  guildId,
                  ids,
                },
              ),
            ),
            Effect.map(Effect.tap((teams) => Effect.log(teams))),
            Effect.map(
              Effect.withSpan("PlayerService.getTeamsById subscription", {
                captureStackTrace: true,
              }),
            ),
            Effect.withSpan("PlayerService.getTeamsById", {
              captureStackTrace: true,
            }),
          ),
        getTeamsByName: (names: ReadonlyArray<string>) =>
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "player.getTeamsByName",
                { guildId, names },
              ),
            ),
            Effect.map(
              Effect.withSpan("PlayerService.getTeamsByName subscription", {
                captureStackTrace: true,
              }),
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
              WebSocketClient.subscribeScoped(
                sheetApisClient.get(),
                "player.mapScheduleWithPlayers",
                { guildId, schedules },
              ),
            ),
            Effect.map(
              Effect.withSpan(
                "PlayerService.mapScheduleWithPlayers subscription",
                {
                  captureStackTrace: true,
                },
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
