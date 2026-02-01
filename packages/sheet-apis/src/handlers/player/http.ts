import { HttpApiBuilder } from "@effect/platform";
import { Array, Effect, HashMap, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { PlayerService } from "@/services/player";
import { GuildConfigService } from "@/services/guildConfig";
import { KubernetesTokenAuthorizationLive } from "@/middlewares/kubernetesTokenAuthorization/live";

const getSheetIdFromGuildId = (guildId: string, guildConfigService: GuildConfigService) =>
  pipe(
    guildConfigService.getGuildConfigByGuildId(guildId),
    Effect.flatMap(
      Option.match({
        onSome: (guildConfig) =>
          pipe(
            guildConfig.sheetId,
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(new Error(`sheetId not found for guildId: ${guildId}`)),
            }),
          ),
        onNone: () => Effect.die(new Error(`Guild config not found for guildId: ${guildId}`)),
      }),
    ),
  );

export const PlayerLive = HttpApiBuilder.group(Api, "player", (handlers) =>
  pipe(
    Effect.all({
      playerService: PlayerService,
      guildConfigService: GuildConfigService,
    }),
    Effect.map(({ playerService, guildConfigService }) =>
      handlers
        .handle("getPlayerMaps", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => playerService.getPlayerMaps(sheetId)),
            Effect.map((playerMaps) => ({
              nameToPlayer: Array.fromIterable(HashMap.entries(playerMaps.nameToPlayer)).map(
                ([key, value]) => ({
                  key,
                  value: { name: value.name, players: Array.fromIterable(value.players) },
                }),
              ),
              idToPlayer: Array.fromIterable(HashMap.entries(playerMaps.idToPlayer)).map(
                ([key, value]) => ({
                  key,
                  value: Array.fromIterable(value),
                }),
              ),
            })),
          ),
        )
        .handle("getByIds", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => playerService.getByIds(sheetId, urlParams.ids)),
          ),
        )
        .handle("getByNames", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => playerService.getByNames(sheetId, urlParams.names)),
          ),
        )
        .handle("getTeamsByIds", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) =>
              Effect.map(
                playerService.getTeamsByIds(sheetId, urlParams.ids),
                (teams) => [teams] as const,
              ),
            ),
          ),
        )
        .handle("getTeamsByNames", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) =>
              Effect.map(
                playerService.getTeamsByNames(sheetId, urlParams.names),
                (teams) => [teams] as const,
              ),
            ),
          ),
        ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      PlayerService.Default,
      GuildConfigService.Default,
      KubernetesTokenAuthorizationLive,
    ),
  ),
);
