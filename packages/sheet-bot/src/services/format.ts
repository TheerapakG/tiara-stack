import { bold, time, TimestampStyles } from "@discordjs/formatters";
import {
  Array,
  Data,
  DateTime,
  Effect,
  Match,
  Number,
  Option,
  Order,
  pipe,
  Random,
  String,
} from "effect";
import { ConverterService, HourWindow } from "./converter";
import { Sheet } from "sheet-apis/schema";

type Weighted<A> = { value: A; weight: number };

const pickWeighted = <A>(items: Array.NonEmptyReadonlyArray<Weighted<A>>) =>
  pipe(
    Effect.Do,
    Effect.bind("accumItems", () =>
      pipe(
        items,
        Array.scan({ value: Option.none<A>(), weight: 0 }, (s, { value, weight }) => ({
          value: Option.some(value),
          weight: s.weight + weight,
        })),
        Array.filterMap(({ value, weight }) =>
          pipe(
            value,
            Option.map((value) => ({ value, weight })),
          ),
        ),
        Array.match({
          onEmpty: () => Effect.die("pickWeighted: impossible"),
          onNonEmpty: (items) => Effect.succeed(items),
        }),
      ),
    ),
    Effect.bind("random", ({ accumItems }) =>
      Random.nextRange(
        0,
        pipe(accumItems, Array.lastNonEmpty, ({ weight }) => weight),
      ),
    ),
    Effect.flatMap(({ accumItems, random }) =>
      pipe(
        accumItems,
        Array.findFirst(({ weight }) => random < weight),
        Option.match({
          onSome: ({ value }) => Effect.succeed(value),
          onNone: () => Effect.die("pickWeighted: impossible"),
        }),
      ),
    ),
  );

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
    Effect.map(({ converterService, formatDateTime, formatHourWindow }) => ({
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
    })),
  ),
  dependencies: [ConverterService.Default],
  accessors: true,
}) {}
