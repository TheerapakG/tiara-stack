import { DateTime, Effect, Option, Match, Hash } from "effect";
import { useMemo } from "react";

export const makeZonedOrNow = (timeZone: DateTime.TimeZone, timestamp?: number) =>
  Option.fromNullable(timestamp).pipe(
    Option.flatMap(DateTime.make),
    Option.match({
      onSome: Effect.succeed,
      onNone: () => DateTime.now,
    }),
    Effect.map(DateTime.setZone(timeZone)),
  );

export const makeZonedOrUndefined = (timeZone: DateTime.TimeZone, timestamp?: number) =>
  Option.fromNullable(timestamp).pipe(
    Option.flatMap(DateTime.make),
    Option.map(DateTime.setZone(timeZone)),
    Option.getOrUndefined,
  );

export const zoneId = (timeZone: DateTime.TimeZone) =>
  Match.value(timeZone).pipe(
    Match.tagsExhaustive({
      Offset: ({ offset }) => offset,
      Named: ({ id }) => id,
    }),
  );

export const useZonedOrNow = (timeZone: DateTime.TimeZone, timestamp?: number) => {
  const zoned = useMemo(
    () => Effect.runSync(makeZonedOrNow(timeZone, timestamp)),
    [zoneId(timeZone), timestamp],
  );
  return zoned;
};

export const useZonedOrUndefined = (timeZone: DateTime.TimeZone, timestamp?: number) => {
  const zoned = useMemo(
    () => makeZonedOrUndefined(timeZone, timestamp),
    [zoneId(timeZone), timestamp],
  );
  return zoned;
};

export const dateTimeId = (dateTime: DateTime.Zoned) =>
  Hash.array([DateTime.toEpochMillis(dateTime), zoneId(dateTime.zone)]);
