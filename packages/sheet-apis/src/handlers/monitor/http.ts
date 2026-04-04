import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Array, Effect, HashMap, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import { provideCurrentGuildUser, requireMonitorGuild } from "@/middlewares/authorization";
import { GuildConfigService, MonitorService } from "@/services";
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

export const monitorLayer = HttpApiBuilder.group(
  Api,
  "monitor",
  Effect.fn(function* (handlers) {
    const monitorService = yield* MonitorService;
    const guildConfigService = yield* GuildConfigService;

    return handlers
      .handle("getMonitorMaps", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          requireMonitorGuild(query.guildId).pipe(
            Effect.andThen(
              pipe(
                getSheetIdFromGuildId(query.guildId, guildConfigService),
                Effect.flatMap((sheetId) => monitorService.getMonitorMaps(sheetId)),
                Effect.map((monitorMaps) => ({
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
                })),
              ),
            ),
          ),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getByIds", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          requireMonitorGuild(query.guildId).pipe(
            Effect.andThen(
              pipe(
                getSheetIdFromGuildId(query.guildId, guildConfigService),
                Effect.flatMap((sheetId) => monitorService.getByIds(sheetId, query.ids)),
              ),
            ),
          ),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getByNames", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          requireMonitorGuild(query.guildId).pipe(
            Effect.andThen(
              pipe(
                getSheetIdFromGuildId(query.guildId, guildConfigService),
                Effect.flatMap((sheetId) => monitorService.getByNames(sheetId, query.names)),
              ),
            ),
          ),
        ).pipe(catchSchemaErrorAsValidationError),
      );
  }),
).pipe(
  Layer.provide([MonitorService.layer, GuildConfigService.layer, SheetAuthTokenAuthorizationLive]),
);
