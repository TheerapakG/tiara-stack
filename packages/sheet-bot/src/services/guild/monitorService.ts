import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
import { WebSocketClient } from "typhoon-client-ws/client";
import { SheetApisClient } from "@/client/sheetApis";
import { GuildService } from "./guildService";

export class MonitorService extends Effect.Service<MonitorService>()("MonitorService", {
  effect: pipe(
    Effect.Do,
    bindObject({
      guildService: GuildService,
      sheetApisClient: SheetApisClient,
    }),
    Effect.bindAll(
      ({ guildService, sheetApisClient }) => ({
        getMonitorMaps: Effect.cached(
          pipe(
            guildService.getId(),
            Effect.flatMap((guildId) =>
              WebSocketClient.subscribeScoped(sheetApisClient.get(), "monitor.getMonitorMaps", {
                guildId,
              }),
            ),
            Effect.map(
              Effect.withSpan("MonitorService.getMonitorMaps subscription", {
                captureStackTrace: true,
              }),
            ),
            Effect.withSpan("MonitorService.getMonitorMaps", {
              captureStackTrace: true,
            }),
          ),
        ),
      }),
      { concurrency: "unbounded" },
    ),
    Effect.map(({ guildService, sheetApisClient, getMonitorMaps }) => ({
      getMonitorMaps,
      getMonitorById: (ids: ReadonlyArray<string>) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            WebSocketClient.subscribeScoped(sheetApisClient.get(), "monitor.getById", {
              guildId,
              ids,
            }),
          ),
          Effect.map(
            Effect.withSpan("MonitorService.getMonitorById subscription", {
              captureStackTrace: true,
            }),
          ),
          Effect.withSpan("MonitorService.getMonitorById", {
            captureStackTrace: true,
          }),
        ),
      getMonitorByName: (names: ReadonlyArray<string>) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            WebSocketClient.subscribeScoped(sheetApisClient.get(), "monitor.getByName", {
              guildId,
              names,
            }),
          ),
          Effect.map(
            Effect.withSpan("MonitorService.getMonitorByName subscription", {
              captureStackTrace: true,
            }),
          ),
          Effect.withSpan("MonitorService.getMonitorByName", {
            captureStackTrace: true,
          }),
        ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
