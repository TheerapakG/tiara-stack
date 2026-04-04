import { Array, DateTime, Duration, Effect, Schema, Stream } from "effect";
import { useAtomSuspense } from "@effect/atom-react";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { useMemo } from "react";

// Normalize date to month start for consistent atom family keys
const normalizeToMonthStart = (dateTime: DateTime.Zoned) => DateTime.startOf(dateTime, "month");

// Get serializable key for the month
const monthKey = (dateTime: DateTime.Zoned) =>
  DateTime.toEpochMillis(normalizeToMonthStart(dateTime));

const _calendarDaysAtom = Atom.family((dateTime: DateTime.Zoned) =>
  Atom.make(
    Effect.fnUntraced(function* () {
      const monthStart = DateTime.startOf(dateTime, "month");
      const monthEnd = DateTime.endOf(dateTime, "month");
      const calendarStart = DateTime.startOf(monthStart, "week", { weekStartsOn: 0 });
      // calendarEnd is the last moment of the day (e.g., 23:59:59.999), while current
      // starts at midnight (00:00:00) each day. This ensures the last day is included
      // regardless of whether DateTime.between is inclusive or exclusive on the maximum.
      const calendarEnd = DateTime.endOf(monthEnd, "week", { weekStartsOn: 0 });

      const days = yield* Stream.iterate(calendarStart, (current) =>
        DateTime.add(current, { days: 1 }),
      ).pipe(
        Stream.takeWhile((current) =>
          DateTime.between(current, { minimum: calendarStart, maximum: calendarEnd }),
        ),
        Stream.map((current) => ({
          day: current,
          isInMonth: DateTime.between(current, { minimum: monthStart, maximum: monthEnd }),
        })),
        Stream.runCollect,
      );

      const daysArray = yield* Array.match(days, {
        onEmpty: () => Effect.die("calendar days is empty, this should never happen"),
        onNonEmpty: (days) => Effect.succeed(days),
      });

      return daysArray;
    }),
  ).pipe(
    Atom.setIdleTTL(Duration.hours(1)),
    Atom.serializable({
      key: `calendarDays.${monthKey(dateTime)}`,
      schema: AsyncResult.Schema({
        success: Schema.NonEmptyArray(
          Schema.Struct({
            day: Schema.DateTimeZoned,
            isInMonth: Schema.Boolean,
          }),
        ),
      }),
    }),
  ),
);

// Wrapper that normalizes input to month start
export const calendarDaysAtom = (dateTime: DateTime.Zoned) =>
  _calendarDaysAtom(normalizeToMonthStart(dateTime));

export const useCalendarDays = (dateTime: DateTime.Zoned) => {
  const atom = useMemo(() => calendarDaysAtom(dateTime), [dateTime]);
  const result = useAtomSuspense(atom, {
    suspendOnWaiting: false,
    includeFailure: false,
  });
  return result.value;
};
