import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class ScheduleService extends Effect.Service<ScheduleService>()("ScheduleService", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      // Filler populated schedules - filtered by visible, with fill/overfill/standby/runners cleared
      allPopulatedFillerSchedules: Effect.fn("Schedule.allPopulatedFillerSchedules")(
        (guildId: string) =>
          sheetApisClient.get().schedule.getAllPopulatedFillerSchedules({ urlParams: { guildId } }),
      ),
      dayPopulatedFillerSchedules: Effect.fn("Schedule.dayPopulatedFillerSchedules")(
        (guildId: string, day: number) =>
          sheetApisClient
            .get()
            .schedule.getDayPopulatedFillerSchedules({ urlParams: { guildId, day } }),
      ),
      channelPopulatedFillerSchedules: Effect.fn("Schedule.channelPopulatedFillerSchedules")(
        (guildId: string, channel: string) =>
          sheetApisClient
            .get()
            .schedule.getChannelPopulatedFillerSchedules({ urlParams: { guildId, channel } }),
      ),
      // Monitor populated schedules - full access, requires monitor authorization
      allPopulatedMonitorSchedules: Effect.fn("Schedule.allPopulatedMonitorSchedules")(
        (guildId: string) =>
          sheetApisClient
            .get()
            .scheduleMonitor.getAllPopulatedMonitorSchedules({ urlParams: { guildId } }),
      ),
      dayPopulatedMonitorSchedules: Effect.fn("Schedule.dayPopulatedMonitorSchedules")(
        (guildId: string, day: number) =>
          sheetApisClient
            .get()
            .scheduleMonitor.getDayPopulatedMonitorSchedules({ urlParams: { guildId, day } }),
      ),
      channelPopulatedMonitorSchedules: Effect.fn("Schedule.channelPopulatedMonitorSchedules")(
        (guildId: string, channel: string) =>
          sheetApisClient.get().scheduleMonitor.getChannelPopulatedMonitorSchedules({
            urlParams: { guildId, channel },
          }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
