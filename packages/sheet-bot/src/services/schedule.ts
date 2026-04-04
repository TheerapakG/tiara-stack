import { Effect, Layer, ServiceMap } from "effect";
import { SheetApisClient } from "./sheetApis";

export class ScheduleService extends ServiceMap.Service<ScheduleService>()("ScheduleService", {
  make: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;

    return {
      // Filler populated schedules - filtered by visible, with fill/overfill/standby/runners cleared
      allPopulatedFillerSchedules: Effect.fn("Schedule.allPopulatedFillerSchedules")(function* (
        guildId: string,
      ) {
        const { schedules } = yield* sheetApisClient.get().schedule.getAllPopulatedSchedules({
          query: { guildId, view: "filler" },
        });
        return schedules;
      }),
      dayPopulatedFillerSchedules: Effect.fn("Schedule.dayPopulatedFillerSchedules")(function* (
        guildId: string,
        day: number,
      ) {
        const { schedules } = yield* sheetApisClient.get().schedule.getDayPopulatedSchedules({
          query: { guildId, day, view: "filler" },
        });
        return schedules;
      }),
      channelPopulatedFillerSchedules: Effect.fn("Schedule.channelPopulatedFillerSchedules")(
        function* (guildId: string, channel: string) {
          const { schedules } = yield* sheetApisClient.get().schedule.getChannelPopulatedSchedules({
            query: { guildId, channel, view: "filler" },
          });
          return schedules;
        },
      ),
      // Monitor populated schedules - full access, requires monitor authorization
      allPopulatedMonitorSchedules: Effect.fn("Schedule.allPopulatedMonitorSchedules")(function* (
        guildId: string,
      ) {
        const { schedules } = yield* sheetApisClient.get().schedule.getAllPopulatedSchedules({
          query: { guildId, view: "monitor" },
        });
        return schedules;
      }),
      dayPopulatedMonitorSchedules: Effect.fn("Schedule.dayPopulatedMonitorSchedules")(function* (
        guildId: string,
        day: number,
      ) {
        const { schedules } = yield* sheetApisClient.get().schedule.getDayPopulatedSchedules({
          query: { guildId, day, view: "monitor" },
        });
        return schedules;
      }),
      dayPlayerSchedule: Effect.fn("Schedule.dayPlayerSchedule")(function* (
        guildId: string,
        day: number,
        accountId: string,
      ) {
        return yield* sheetApisClient.get().schedule.getDayPlayerSchedule({
          query: { guildId, day, accountId, view: "monitor" },
        });
      }),
      channelPopulatedMonitorSchedules: Effect.fn("Schedule.channelPopulatedMonitorSchedules")(
        function* (guildId: string, channel: string) {
          const { schedules } = yield* sheetApisClient.get().schedule.getChannelPopulatedSchedules({
            query: { guildId, channel, view: "monitor" },
          });
          return schedules;
        },
      ),
    };
  }),
}) {
  static layer = Layer.effect(ScheduleService, this.make).pipe(
    Layer.provide(SheetApisClient.layer),
  );
}
