import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class ScheduleService extends Effect.Service<ScheduleService>()("ScheduleService", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      allPopulatedSchedules: Effect.fn("Schedule.allPopulatedSchedules")((guildId: string) =>
        sheetApisClient.get().schedule.getAllPopulatedSchedules({ urlParams: { guildId } }),
      ),
      dayPopulatedSchedules: Effect.fn("Schedule.dayPopulatedSchedules")(
        (guildId: string, day: number) =>
          sheetApisClient.get().schedule.getDayPopulatedSchedules({ urlParams: { guildId, day } }),
      ),
      channelPopulatedSchedules: Effect.fn("Schedule.channelPopulatedSchedules")(
        (guildId: string, channel: string) =>
          sheetApisClient
            .get()
            .schedule.getChannelPopulatedSchedules({ urlParams: { guildId, channel } }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
