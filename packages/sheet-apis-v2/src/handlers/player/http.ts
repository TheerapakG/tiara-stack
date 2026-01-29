import { HttpApiBuilder } from "@effect/platform";
import { Effect, HashMap, Layer, pipe } from "effect";
import { Api } from "@/api";
import { PlayerService } from "@/services/player";

export const PlayerLive = HttpApiBuilder.group(Api, "player", (handlers) =>
  pipe(
    Effect.all({
      playerService: PlayerService,
    }),
    Effect.map(({ playerService }) =>
      handlers
        .handle("getPlayerMaps", () =>
          pipe(
            playerService.getPlayerMaps(),
            Effect.map((playerMaps) => ({
              nameToPlayer: Array.from(HashMap.entries(playerMaps.nameToPlayer)).map(
                ([key, value]) => ({
                  key,
                  value: { name: value.name, players: Array.from(value.players) },
                }),
              ),
              idToPlayer: Array.from(HashMap.entries(playerMaps.idToPlayer)).map(
                ([key, value]) => ({
                  key,
                  value: Array.from(value),
                }),
              ),
            })),
          ),
        )
        .handle("getByIds", ({ urlParams }) =>
          playerService.getByIds(urlParams.sheetId, urlParams.ids),
        )
        .handle("getByNames", ({ urlParams }) =>
          playerService.getByNames(urlParams.sheetId, urlParams.names),
        )
        .handle("getTeamsByIds", ({ urlParams }) =>
          Effect.map(
            playerService.getTeamsByIds(urlParams.sheetId, urlParams.ids),
            (teams) => [teams] as const,
          ),
        )
        .handle("getTeamsByNames", ({ urlParams }) =>
          Effect.map(
            playerService.getTeamsByNames(urlParams.sheetId, urlParams.names),
            (teams) => [teams] as const,
          ),
        ),
    ),
  ),
).pipe(Layer.provide(PlayerService.Default));
