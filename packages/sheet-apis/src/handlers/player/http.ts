import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Array, Effect, HashMap, Layer, Option } from "effect";
import { Api } from "@/api";
import { withCurrentGuildAuthFromQuery } from "@/handlers/shared/guildAuthorization";
import { AuthorizationService, PlayerService, GuildConfigService } from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";

const getSheetIdFromGuildId = Effect.fn("player.getSheetIdFromGuildId")(function* (
  guildId: string,
  guildConfigService: typeof GuildConfigService.Service,
) {
  const guildConfig = yield* guildConfigService.getGuildConfig(guildId);

  if (Option.isNone(guildConfig)) {
    return yield* Effect.die(new Error(`Guild config not found for guildId: ${guildId}`));
  }

  if (Option.isNone(guildConfig.value.sheetId)) {
    return yield* Effect.die(new Error(`sheetId not found for guildId: ${guildId}`));
  }

  return guildConfig.value.sheetId.value;
});

export const playerLayer = HttpApiBuilder.group(
  Api,
  "player",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const playerService = yield* PlayerService;
    const guildConfigService = yield* GuildConfigService;
    const withQueryGuildAuth = withCurrentGuildAuthFromQuery(authorizationService);

    return handlers
      .handle(
        "getPlayerMaps",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            yield* authorizationService.requireMonitorGuild(query.guildId);
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const playerMaps = yield* playerService.getPlayerMaps(sheetId);

            return {
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
            };
          }),
        ),
      )
      .handle(
        "getByIds",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            const auth =
              query.ids.length === 1
                ? authorizationService.requireDiscordAccountIdOrMonitorGuild(
                    query.guildId,
                    query.ids[0],
                  )
                : authorizationService.requireMonitorGuild(query.guildId);

            yield* auth;
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            return yield* playerService.getByIds(sheetId, query.ids);
          }),
        ),
      )
      .handle(
        "getByNames",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            yield* authorizationService.requireMonitorGuild(query.guildId);
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            return yield* playerService.getByNames(sheetId, query.names);
          }),
        ),
      )
      .handle(
        "getTeamsByIds",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            const auth =
              query.ids.length === 1
                ? authorizationService.requireDiscordAccountIdOrMonitorGuild(
                    query.guildId,
                    query.ids[0],
                  )
                : authorizationService.requireMonitorGuild(query.guildId);

            yield* auth;
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const teams = yield* playerService.getTeamsByIds(sheetId, query.ids);
            return [teams] as const;
          }),
        ),
      )
      .handle(
        "getTeamsByNames",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            yield* authorizationService.requireMonitorGuild(query.guildId);
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const teams = yield* playerService.getTeamsByNames(sheetId, query.names);
            return [teams] as const;
          }),
        ),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    PlayerService.layer,
    GuildConfigService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
