import { bindObject } from "@/utils";
import { Effect, pipe } from "effect";
import { SheetApisClient } from "@/client/sheetApis";
import { GuildService } from "./guildService";

export class ScheduleService extends Effect.Service<ScheduleService>()("ScheduleService", {
  effect: pipe(
    Effect.Do,
    bindObject({
      guildService: GuildService,
      sheetApisClient: SheetApisClient,
    }),
    Effect.bindAll(({ guildService, sheetApisClient }) => ({
      allPopulatedSchedules: Effect.cached(
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient.get().schedule.getAllPopulatedSchedules({ urlParams: { guildId } }),
          ),
          Effect.withSpan("ScheduleService.allPopulatedSchedules", {
            captureStackTrace: true,
          }),
        ),
      ),
      dayPopulatedSchedules: Effect.cachedFunction((day: number) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient
              .get()
              .schedule.getDayPopulatedSchedules({ urlParams: { guildId, day } }),
          ),
          Effect.withSpan("ScheduleService.dayPopulatedSchedules", {
            captureStackTrace: true,
          }),
        ),
      ),
      channelPopulatedSchedules: Effect.cachedFunction((channel: string) =>
        pipe(
          guildService.getId(),
          Effect.flatMap((guildId) =>
            sheetApisClient
              .get()
              .schedule.getChannelPopulatedSchedules({ urlParams: { guildId, channel } }),
          ),
          Effect.withSpan("ScheduleService.channelPopulatedSchedules", {
            captureStackTrace: true,
          }),
        ),
      ),
    })),
    Effect.map(({ allPopulatedSchedules, dayPopulatedSchedules, channelPopulatedSchedules }) => ({
      allPopulatedSchedules: () => allPopulatedSchedules,
      dayPopulatedSchedules,
      channelPopulatedSchedules,
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
