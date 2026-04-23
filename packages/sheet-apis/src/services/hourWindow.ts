import { DateTime, Duration, Match, Option, pipe } from "effect";
import { BreakSchedule, Schedule, ScheduleHourWindow } from "@/schemas/sheet";

export const deriveScheduleHourWindow = (
  startTime: DateTime.Utc,
  hour: Option.Option<number>,
): Option.Option<ScheduleHourWindow> =>
  pipe(
    hour,
    Option.map(
      (value) =>
        new ScheduleHourWindow({
          start: pipe(startTime, DateTime.addDuration(Duration.hours(value - 1))),
          end: pipe(startTime, DateTime.addDuration(Duration.hours(value))),
        }),
    ),
  );

export const withScheduleHourWindow = (
  startTime: DateTime.Utc,
  schedule: BreakSchedule | Schedule,
): BreakSchedule | Schedule =>
  Match.value(schedule).pipe(
    Match.tagsExhaustive({
      BreakSchedule: (schedule) =>
        new BreakSchedule({
          channel: schedule.channel,
          day: schedule.day,
          visible: schedule.visible,
          hour: schedule.hour,
          hourWindow: deriveScheduleHourWindow(startTime, schedule.hour),
        }),
      Schedule: (schedule) =>
        new Schedule({
          channel: schedule.channel,
          day: schedule.day,
          visible: schedule.visible,
          hour: schedule.hour,
          hourWindow: deriveScheduleHourWindow(startTime, schedule.hour),
          fills: schedule.fills,
          overfills: schedule.overfills,
          standbys: schedule.standbys,
          runners: schedule.runners,
          monitor: schedule.monitor,
        }),
    }),
  );
