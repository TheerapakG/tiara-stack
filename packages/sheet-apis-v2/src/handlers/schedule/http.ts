import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, pipe } from "effect";
import { Api } from "@/api";
import { ScheduleService } from "@/services/schedule";

export const ScheduleLive = HttpApiBuilder.group(Api, "schedule", (handlers) =>
  pipe(
    Effect.all({
      scheduleService: ScheduleService,
    }),
    Effect.map(({ scheduleService }) =>
      handlers
        .handle("getAllPopulatedSchedules", ({ urlParams }) =>
          scheduleService.getAllPopulatedSchedules(urlParams.sheetId),
        )
        .handle("getDayPopulatedSchedules", ({ urlParams }) =>
          scheduleService.getDayPopulatedSchedules(urlParams.sheetId, urlParams.day),
        )
        .handle("getChannelPopulatedSchedules", ({ urlParams }) =>
          scheduleService.getChannelPopulatedSchedules(urlParams.sheetId, urlParams.channel),
        ),
    ),
  ),
).pipe(Layer.provide(ScheduleService.Default));
