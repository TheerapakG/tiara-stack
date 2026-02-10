import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
import { SheetApisClient } from "@/client/sheetApis";
import { GuildService } from "./guildService";

export class PlayerService extends Effect.Service<PlayerService>()("PlayerService", {
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
              sheetApisClient.get().player.getPlayerMaps({ urlParams: { guildId } }),
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
            sheetApisClient.get().player.getByIds({ urlParams: { guildId, ids } }),
          ),
          Effect.withSpan("PlayerService.getPlayerById", {
            captureStackTrace: true,
          }),
        ),
      getPlayerByName: (names: ReadonlyArray<string>) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().player.getByNames({ urlParams: { guildId, names } }),
          ),
          Effect.withSpan("PlayerService.getPlayerByName", {
            captureStackTrace: true,
          }),
        ),
      getTeamsById: (ids: ReadonlyArray<string>) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().player.getTeamsByIds({ urlParams: { guildId, ids } }),
          ),
          Effect.withSpan("PlayerService.getTeamsById", {
            captureStackTrace: true,
          }),
        ),
      getTeamsByName: (names: ReadonlyArray<string>) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().player.getTeamsByNames({ urlParams: { guildId, names } }),
          ),
          Effect.withSpan("PlayerService.getTeamsByName", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
