import { bold, time, TimestampStyles } from "@discordjs/formatters";
import { Array, Data, DateTime, Effect, Match, Number, Option, Order, pipe, String } from "effect";
import { ConverterService, HourWindow } from "./converter";
import { Sheet } from "sheet-apis/schema";

export class FormattedHourWindow extends Data.TaggedClass("FormattedHourWindow")<{
  start: number;
  end: number;
}> {}

export class FormatService extends Effect.Service<FormatService>()("FormatService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("converterService", () => ConverterService),
    Effect.let(
      "formatDateTime",
      () => (dateTime: DateTime.DateTime) =>
        pipe(dateTime, DateTime.toEpochMillis, Number.unsafeDivide(1000)),
    ),
    Effect.let("formatHourWindow", ({ formatDateTime }) =>
      Effect.fn("FormatService.formatHourWindow")((hourWindow: HourWindow) =>
        Effect.succeed(
          new FormattedHourWindow({
            start: formatDateTime(hourWindow.start),
            end: formatDateTime(hourWindow.end),
          }),
        ),
      ),
    ),
    Effect.let(
      "formatScheduleHourWindow",
      ({ formatHourWindow }) =>
        <R>(
          schedule: Sheet.PopulatedBreakSchedule | Sheet.PopulatedSchedule,
          onNone: () => Effect.Effect<string, never, R>,
          render: (hourWindow: FormattedHourWindow) => string,
        ): Effect.Effect<string, never, R> =>
          pipe(
            schedule.hourWindow,
            Option.map((hourWindow) =>
              pipe(
                new HourWindow({
                  start: hourWindow.start,
                  end: hourWindow.end,
                }),
                formatHourWindow,
                Effect.map(render),
              ),
            ),
            Option.getOrElse(onNone),
          ),
    ),
    Effect.map(
      ({ converterService, formatDateTime, formatHourWindow, formatScheduleHourWindow }) => ({
        formatDateTime,
        formatHourWindow,
        formatOpenSlot: Effect.fn("FormatService.formatOpenSlot")(
          (guildId: string, schedule: Sheet.PopulatedBreakSchedule | Sheet.PopulatedSchedule) =>
            pipe(
              Match.value(schedule),
              Match.tagsExhaustive({
                PopulatedBreakSchedule: () => Effect.succeed(""),
                PopulatedSchedule: (schedule) =>
                  pipe(
                    Effect.succeed({
                      hour: schedule.hour,
                      empty: Sheet.PopulatedSchedule.empty(schedule),
                    }),
                    Effect.let("slotCountString", ({ empty }) =>
                      schedule.visible ? bold(`+${empty} |`) : "",
                    ),
                    Effect.let("hourString", ({ hour }) =>
                      pipe(
                        hour,
                        Option.map((hour) => bold(`hour ${hour}`)),
                        Option.getOrElse(() => bold("hour ??")),
                      ),
                    ),
                    Effect.bind("rangeString", ({ hour }) =>
                      formatScheduleHourWindow(
                        schedule,
                        () =>
                          pipe(
                            hour,
                            Option.map((h) =>
                              pipe(
                                converterService.convertHourToHourWindow(guildId, h),
                                Effect.flatMap(formatHourWindow),
                                Effect.map(
                                  (hw) =>
                                    `${time(hw.start, TimestampStyles.ShortTime)}-${time(hw.end, TimestampStyles.ShortTime)}`,
                                ),
                                Effect.catchAll(() => Effect.succeed("??-??")),
                              ),
                            ),
                            Option.getOrElse(() => Effect.succeed("??-??")),
                          ),
                        (hw) =>
                          `${time(hw.start, TimestampStyles.ShortTime)}-${time(hw.end, TimestampStyles.ShortTime)}`,
                      ),
                    ),
                    Effect.map(({ empty, slotCountString, hourString, rangeString }) =>
                      !schedule.visible || Order.greaterThan(Number.Order)(empty, 0)
                        ? pipe(
                            [slotCountString, hourString, rangeString],
                            Array.filter(String.isNonEmpty),
                            Array.join(" "),
                          )
                        : "",
                    ),
                  ),
              }),
            ),
        ),
        formatFilledSlot: Effect.fn("FormatService.formatFilledSlot")(
          (guildId: string, schedule: Sheet.PopulatedBreakSchedule | Sheet.PopulatedSchedule) =>
            pipe(
              Match.value(schedule),
              Match.tagsExhaustive({
                PopulatedBreakSchedule: () => Effect.succeed(""),
                PopulatedSchedule: (schedule) =>
                  pipe(
                    Effect.succeed({
                      hour: schedule.hour,
                      empty: Sheet.PopulatedSchedule.empty(schedule),
                    }),
                    Effect.let("hourString", ({ hour }) =>
                      pipe(
                        hour,
                        Option.map((hour) => bold(`hour ${hour}`)),
                        Option.getOrElse(() => bold("hour ??")),
                      ),
                    ),
                    Effect.bind("rangeString", ({ hour }) =>
                      formatScheduleHourWindow(
                        schedule,
                        () =>
                          pipe(
                            hour,
                            Option.map((h) =>
                              pipe(
                                converterService.convertHourToHourWindow(guildId, h),
                                Effect.flatMap(formatHourWindow),
                                Effect.map(
                                  (hw) =>
                                    `${time(hw.start, TimestampStyles.ShortTime)}-${time(hw.end, TimestampStyles.ShortTime)}`,
                                ),
                                Effect.catchAll(() => Effect.succeed("??-??")),
                              ),
                            ),
                            Option.getOrElse(() => Effect.succeed("??-??")),
                          ),
                        (hw) =>
                          `${time(hw.start, TimestampStyles.ShortTime)}-${time(hw.end, TimestampStyles.ShortTime)}`,
                      ),
                    ),
                    Effect.map(({ empty, hourString, rangeString }) =>
                      schedule.visible && Number.Equivalence(empty, 0)
                        ? pipe(
                            [hourString, rangeString],
                            Array.filter(String.isNonEmpty),
                            Array.join(" "),
                          )
                        : "",
                    ),
                  ),
              }),
            ),
        ),
      }),
    ),
  ),
  dependencies: [ConverterService.Default],
  accessors: true,
}) {}
