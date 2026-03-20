import { DateTime, Option, Match, Hash } from "effect";
import { useMemo } from "react";

export const makeZoned = (timeZone: DateTime.TimeZone, timestamp: DateTime.DateTime) =>
  DateTime.setZone(timestamp, timeZone);

export const makeZonedOptional = (timeZone: DateTime.TimeZone, timestamp?: DateTime.DateTime) =>
  Option.fromNullable(timestamp).pipe(
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

export const useZoned = (timeZone: DateTime.TimeZone, timestamp: DateTime.DateTime) => {
  const zoned = useMemo(() => makeZoned(timeZone, timestamp), [zoneId(timeZone), timestamp]);
  return zoned;
};

export const useZonedOptional = (timeZone: DateTime.TimeZone, timestamp?: DateTime.DateTime) => {
  const zoned = useMemo(
    () => makeZonedOptional(timeZone, timestamp),
    [zoneId(timeZone), timestamp],
  );
  return zoned;
};

export const dateTimeId = (dateTime: DateTime.Zoned) =>
  Hash.array([DateTime.toEpochMillis(dateTime), zoneId(dateTime.zone)]);
