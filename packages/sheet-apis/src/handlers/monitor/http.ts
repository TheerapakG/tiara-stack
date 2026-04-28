import { Array, Effect, HashMap, Layer, Option } from "effect";
import { MonitorRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { withCurrentGuildAuthFromQuery } from "@/handlers/shared/guildAuthorization";
import { AuthorizationService, GuildConfigService, MonitorService } from "@/services";

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

export const monitorLayer = MonitorRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const monitorService = yield* MonitorService;
    const guildConfigService = yield* GuildConfigService;
    const withQueryGuildAuth = withCurrentGuildAuthFromQuery(authorizationService);

    return {
      "monitor.getMonitorMaps": withQueryGuildAuth(
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
      "monitor.getByIds": withQueryGuildAuth(
        Effect.fnUntraced(function* ({ query }) {
          yield* authorizationService.requireMonitorGuild(query.guildId);
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* monitorService.getByIds(sheetId, query.ids);
        }),
      ),
      "monitor.getByNames": withQueryGuildAuth(
        Effect.fnUntraced(function* ({ query }) {
          yield* authorizationService.requireMonitorGuild(query.guildId);
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* monitorService.getByNames(sheetId, query.names);
        }),
      ),
    };
  }),
).pipe(Layer.provide([AuthorizationService.layer, MonitorService.layer, GuildConfigService.layer]));
