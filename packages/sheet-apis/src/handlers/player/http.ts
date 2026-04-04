import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Array, Effect, HashMap, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import {
  provideCurrentGuildUser,
  requireDiscordAccountIdOrMonitorGuild,
  requireMonitorGuild,
} from "@/middlewares/authorization";
import { PlayerService, GuildConfigService } from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";

const getSheetIdFromGuildId = (
  guildId: string,
  guildConfigService: typeof GuildConfigService.Service,
) =>
  pipe(
    guildConfigService.getGuildConfig(guildId),
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

export const playerLayer = HttpApiBuilder.group(
  Api,
  "player",
  Effect.fn(function* (handlers) {
    const playerService = yield* PlayerService;
    const guildConfigService = yield* GuildConfigService;

    return handlers
      .handle("getPlayerMaps", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          requireMonitorGuild(query.guildId).pipe(
            Effect.andThen(
              pipe(
                getSheetIdFromGuildId(query.guildId, guildConfigService),
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
            ),
          ),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getByIds", ({ query }) => {
        const auth =
          query.ids.length === 1
            ? requireDiscordAccountIdOrMonitorGuild(query.guildId, query.ids[0])
            : requireMonitorGuild(query.guildId);

        return provideCurrentGuildUser(
          query.guildId,
          auth.pipe(
            Effect.andThen(
              pipe(
                getSheetIdFromGuildId(query.guildId, guildConfigService),
                Effect.flatMap((sheetId) => playerService.getByIds(sheetId, query.ids)),
              ),
            ),
          ),
        ).pipe(catchSchemaErrorAsValidationError);
      })
      .handle("getByNames", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          requireMonitorGuild(query.guildId).pipe(
            Effect.andThen(
              pipe(
                getSheetIdFromGuildId(query.guildId, guildConfigService),
                Effect.flatMap((sheetId) => playerService.getByNames(sheetId, query.names)),
              ),
            ),
          ),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getTeamsByIds", ({ query }) => {
        const auth =
          query.ids.length === 1
            ? requireDiscordAccountIdOrMonitorGuild(query.guildId, query.ids[0])
            : requireMonitorGuild(query.guildId);

        return provideCurrentGuildUser(
          query.guildId,
          auth.pipe(
            Effect.andThen(
              pipe(
                getSheetIdFromGuildId(query.guildId, guildConfigService),
                Effect.flatMap((sheetId) =>
                  Effect.map(
                    playerService.getTeamsByIds(sheetId, query.ids),
                    (teams) => [teams] as const,
                  ),
                ),
              ),
            ),
          ),
        ).pipe(catchSchemaErrorAsValidationError);
      })
      .handle("getTeamsByNames", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          requireMonitorGuild(query.guildId).pipe(
            Effect.andThen(
              pipe(
                getSheetIdFromGuildId(query.guildId, guildConfigService),
                Effect.flatMap((sheetId) =>
                  Effect.map(
                    playerService.getTeamsByNames(sheetId, query.names),
                    (teams) => [teams] as const,
                  ),
                ),
              ),
            ),
          ),
        ).pipe(catchSchemaErrorAsValidationError),
      );
  }),
).pipe(
  Layer.provide([PlayerService.layer, GuildConfigService.layer, SheetAuthTokenAuthorizationLive]),
);
