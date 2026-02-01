import { HttpApiBuilder } from "@effect/platform";
import { Array, Effect, HashMap, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { MonitorService } from "@/services/monitor";
import { GuildConfigService } from "@/services/guildConfig";

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

export const MonitorLive = HttpApiBuilder.group(Api, "monitor", (handlers) =>
  pipe(
    Effect.all({
      monitorService: MonitorService,
      guildConfigService: GuildConfigService,
    }),
    Effect.map(({ monitorService, guildConfigService }) =>
      handlers
        .handle("getMonitorMaps", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
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
        )
        .handle("getByIds", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => monitorService.getByIds(sheetId, urlParams.ids)),
          ),
        )
        .handle("getByNames", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => monitorService.getByNames(sheetId, urlParams.names)),
          ),
        ),
    ),
  ),
).pipe(Layer.provide(MonitorService.Default), Layer.provide(GuildConfigService.Default));
