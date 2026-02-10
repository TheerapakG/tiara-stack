import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
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
              sheetApisClient.get().monitor.getMonitorMaps({ urlParams: { guildId } }),
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
            sheetApisClient.get().monitor.getByIds({ urlParams: { guildId, ids } }),
          ),
          Effect.withSpan("MonitorService.getMonitorById", {
            captureStackTrace: true,
          }),
        ),
      getMonitorByName: (names: ReadonlyArray<string>) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().monitor.getByNames({ urlParams: { guildId, names } }),
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
