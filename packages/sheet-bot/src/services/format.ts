import { bold, time, TimestampStyles } from "@discordjs/formatters";
import {
  Array,
  Data,
  DateTime,
  Effect,
  Layer,
  Match,
  Number,
  Option,
  Order,
  pipe,
  ServiceMap,
  String,
} from "effect";
import { ConverterService, HourWindow } from "./converter";
import { Sheet } from "sheet-apis/schema";

export class FormattedHourWindow extends Data.TaggedClass("FormattedHourWindow")<{
  start: number;
  end: number;
}> {}

export class FormatService extends ServiceMap.Service<FormatService>()("FormatService", {
  make: Effect.gen(function* () {
    const converterService = yield* ConverterService;

    const formatDateTime = (dateTime: DateTime.DateTime) =>
      pipe(dateTime, DateTime.toEpochMillis, (millis) => millis / 1000);

    const formatHourWindow = Effect.fn("FormatService.formatHourWindow")(function* (
      hourWindow: HourWindow,
    ) {
      return yield* Effect.succeed(
        new FormattedHourWindow({
          start: formatDateTime(hourWindow.start),
          end: formatDateTime(hourWindow.end),
        }),
      );
    });

    const formatScheduleHourWindow = <R>(
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
      );

    return {
      formatDateTime,
      formatHourWindow,
      formatOpenSlot: Effect.fn("FormatService.formatOpenSlot")(function* (
        guildId: string,
        schedule: Sheet.PopulatedBreakSchedule | Sheet.PopulatedSchedule,
      ) {
        return yield* Match.value(schedule).pipe(
          Match.tagsExhaustive({
            PopulatedBreakSchedule: () => Effect.succeed(""),
            PopulatedSchedule: Effect.fnUntraced(function* (schedule: Sheet.PopulatedSchedule) {
              const hour = schedule.hour;
              const empty = Sheet.PopulatedSchedule.empty(schedule);
              const slotCountString = schedule.visible ? bold(`+${empty} |`) : "";
              const hourString = pipe(
                hour,
                Option.map((hour) => bold(`hour ${hour}`)),
                Option.getOrElse(() => bold("hour ??")),
              );
              const rangeString = yield* formatScheduleHourWindow(
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
                        Effect.catch(() => Effect.succeed("??-??")),
                      ),
                    ),
                    Option.getOrElse(() => Effect.succeed("??-??")),
                  ),
                (hw) =>
                  `${time(hw.start, TimestampStyles.ShortTime)}-${time(hw.end, TimestampStyles.ShortTime)}`,
              );

              return !schedule.visible || Order.isGreaterThan(Number.Order)(empty, 0)
                ? pipe(
                    [slotCountString, hourString, rangeString],
                    Array.filter(String.isNonEmpty),
                    Array.join(" "),
                  )
                : "";
            }),
          }),
        );
      }),
      formatFilledSlot: Effect.fn("FormatService.formatFilledSlot")(function* (
        guildId: string,
        schedule: Sheet.PopulatedBreakSchedule | Sheet.PopulatedSchedule,
      ) {
        return yield* Match.value(schedule).pipe(
          Match.tagsExhaustive({
            PopulatedBreakSchedule: () => Effect.succeed(""),
            PopulatedSchedule: Effect.fnUntraced(function* (schedule: Sheet.PopulatedSchedule) {
              const hour = schedule.hour;
              const empty = Sheet.PopulatedSchedule.empty(schedule);
              const hourString = pipe(
                hour,
                Option.map((hour) => bold(`hour ${hour}`)),
                Option.getOrElse(() => bold("hour ??")),
              );
              const rangeString = yield* formatScheduleHourWindow(
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
                        Effect.catch(() => Effect.succeed("??-??")),
                      ),
                    ),
                    Option.getOrElse(() => Effect.succeed("??-??")),
                  ),
                (hw) =>
                  `${time(hw.start, TimestampStyles.ShortTime)}-${time(hw.end, TimestampStyles.ShortTime)}`,
              );

              return schedule.visible && Number.Equivalence(empty, 0)
                ? pipe([hourString, rangeString], Array.filter(String.isNonEmpty), Array.join(" "))
                : "";
            }),
          }),
        );
      }),
    };
  }),
}) {
  static layer = Layer.effect(FormatService, this.make).pipe(Layer.provide(ConverterService.layer));
}
