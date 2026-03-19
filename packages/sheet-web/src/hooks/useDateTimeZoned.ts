import { DateTime, Effect, Option, Match, Hash } from "effect";
import { useMemo, useSyncExternalStore } from "react";

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

let cachedCurrentDateTime = Effect.runSync(DateTime.now);

const getCurrentDateTimeSnapshot = () => cachedCurrentDateTime;
const getCurrentEpochMillis = () => DateTime.toEpochMillis(Effect.runSync(DateTime.now));

const subscribeToCurrentDateTime = (onStoreChange: () => void) => {
  let intervalId: number | undefined;
  const notify = () => {
    cachedCurrentDateTime = Effect.runSync(DateTime.now);
    onStoreChange();
  };
  const timeoutId = window.setTimeout(
    () => {
      notify();
      intervalId = window.setInterval(notify, 60_000);
    },
    60_000 - (getCurrentEpochMillis() % 60_000),
  );

  return () => {
    window.clearTimeout(timeoutId);
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
    }
  };
};

export const useCurrentDateTime = () =>
  useSyncExternalStore(
    subscribeToCurrentDateTime,
    getCurrentDateTimeSnapshot,
    getCurrentDateTimeSnapshot,
  );

export const dateTimeId = (dateTime: DateTime.Zoned) =>
  Hash.array([DateTime.toEpochMillis(dateTime), zoneId(dateTime.zone)]);
