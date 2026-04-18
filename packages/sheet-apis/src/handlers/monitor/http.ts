import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Array, Effect, HashMap, Layer, Option } from "effect";
import { Api } from "@/api";
import { withCurrentGuildAuthFromQuery } from "@/handlers/shared/guildAuthorization";
import { AuthorizationService, GuildConfigService, MonitorService } from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";

const getSheetIdFromGuildId = Effect.fn("monitor.getSheetIdFromGuildId")(function* (
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

export const monitorLayer = HttpApiBuilder.group(
  Api,
  "monitor",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const monitorService = yield* MonitorService;
    const guildConfigService = yield* GuildConfigService;
    const withQueryGuildAuth = withCurrentGuildAuthFromQuery(authorizationService);

    return handlers
      .handle(
        "getMonitorMaps",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            yield* authorizationService.requireMonitorGuild(query.guildId);
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const monitorMaps = yield* monitorService.getMonitorMaps(sheetId);

            return {
              idToMonitor: Array.fromIterable(HashMap.entries(monitorMaps.idToMonitor)).map(
                ([key, value]) => ({
                  key,
                  value: Array.fromIterable(value),
                }),
              ),
              nameToMonitor: Array.fromIterable(HashMap.entries(monitorMaps.nameToMonitor)).map(
                ([key, value]) => ({
                  key,
                  value: { name: value.name, monitors: Array.fromIterable(value.monitors) },
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
            yield* authorizationService.requireMonitorGuild(query.guildId);
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            return yield* monitorService.getByIds(sheetId, query.ids);
          }),
        ),
      )
      .handle(
        "getByNames",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            yield* authorizationService.requireMonitorGuild(query.guildId);
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            return yield* monitorService.getByNames(sheetId, query.names);
          }),
        ),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    MonitorService.layer,
    GuildConfigService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
