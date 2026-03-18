import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class ScheduleService extends Effect.Service<ScheduleService>()("ScheduleService", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      // Filler populated schedules - filtered by visible, with fill/overfill/standby/runners cleared
      allPopulatedFillerSchedules: Effect.fn("Schedule.allPopulatedFillerSchedules")(
        (guildId: string) =>
          sheetApisClient
            .get()
            .schedule.getAllPopulatedSchedules({ urlParams: { guildId, view: "filler" } })
            .pipe(Effect.map(({ schedules }) => schedules)),
      ),
      dayPopulatedFillerSchedules: Effect.fn("Schedule.dayPopulatedFillerSchedules")(
        (guildId: string, day: number) =>
          sheetApisClient
            .get()
            .schedule.getDayPopulatedSchedules({ urlParams: { guildId, day, view: "filler" } })
            .pipe(Effect.map(({ schedules }) => schedules)),
      ),
      channelPopulatedFillerSchedules: Effect.fn("Schedule.channelPopulatedFillerSchedules")(
        (guildId: string, channel: string) =>
          sheetApisClient
            .get()
            .schedule.getChannelPopulatedSchedules({
              urlParams: { guildId, channel, view: "filler" },
            })
            .pipe(Effect.map(({ schedules }) => schedules)),
      ),
      // Monitor populated schedules - full access, requires monitor authorization
      allPopulatedMonitorSchedules: Effect.fn("Schedule.allPopulatedMonitorSchedules")(
        (guildId: string) =>
          sheetApisClient
            .get()
            .schedule.getAllPopulatedSchedules({ urlParams: { guildId, view: "monitor" } })
            .pipe(Effect.map(({ schedules }) => schedules)),
      ),
      dayPopulatedMonitorSchedules: Effect.fn("Schedule.dayPopulatedMonitorSchedules")(
        (guildId: string, day: number) =>
          sheetApisClient
            .get()
            .schedule.getDayPopulatedSchedules({ urlParams: { guildId, day, view: "monitor" } })
            .pipe(Effect.map(({ schedules }) => schedules)),
      ),
      channelPopulatedMonitorSchedules: Effect.fn("Schedule.channelPopulatedMonitorSchedules")(
        (guildId: string, channel: string) =>
          sheetApisClient
            .get()
            .schedule.getChannelPopulatedSchedules({
              urlParams: { guildId, channel, view: "monitor" },
            })
            .pipe(Effect.map(({ schedules }) => schedules)),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
