import { useAtomSuspense } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { Cron, DateTime, Effect, Schedule, Stream } from "effect";

export const nowByMinute = Atom.family((timeZone: DateTime.TimeZone) =>
  Atom.make(
    Stream.fromEffectSchedule(
      DateTime.nowInCurrentZone.pipe(
        Effect.map(DateTime.startOf("minute")),
        DateTime.withCurrentZone(timeZone),
      ),
      Schedule.recurs(0).pipe(
        Schedule.andThen(
          Schedule.cron(
            Cron.make({
              seconds: [0],
              minutes: [],
              hours: [],
              days: [],
              months: [],
              weekdays: [],
              tz: timeZone,
            }),
          ),
        ),
      ),
    ),
  ),
);
export const useNowByMinute = (timeZone: DateTime.TimeZone) => {
  const result = useAtomSuspense(nowByMinute(timeZone), {
    suspendOnWaiting: false,
    includeFailure: false,
  });
  return result.value;
};

export const nowByHour = Atom.family((timeZone: DateTime.TimeZone) =>
  Atom.make(
    Stream.fromEffectSchedule(
      DateTime.nowInCurrentZone.pipe(
        Effect.map(DateTime.startOf("hour")),
        DateTime.withCurrentZone(timeZone),
      ),
      Schedule.recurs(0).pipe(
        Schedule.andThen(
          Schedule.cron(
            Cron.make({
              seconds: [0],
              minutes: [0],
              hours: [],
              days: [],
              months: [],
              weekdays: [],
              tz: timeZone,
            }),
          ),
        ),
      ),
    ),
  ),
);
export const useNowByHour = (timeZone: DateTime.TimeZone) => {
  const result = useAtomSuspense(nowByHour(timeZone), {
    suspendOnWaiting: false,
    includeFailure: false,
  });
  return result.value;
};
