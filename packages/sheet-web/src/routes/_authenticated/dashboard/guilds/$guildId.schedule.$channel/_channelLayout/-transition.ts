import { DateTime } from "effect";
import { Atom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useCallback, useMemo } from "react";
import { formatDayKey } from "#/lib/schedule";

export const morphLayoutTransition = {
  duration: 0.35,
  ease: [0.4, 0, 0.2, 1],
} as const;

export const calendarRestTransition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
} as const;

export const monthSlideTransition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1],
} as const;

export type MonthDirection = -1 | 0 | 1;

export interface SelectedDayTransition {
  readonly day: DateTime.Zoned;
  readonly sourceMonth: DateTime.Zoned;
  readonly phase: "to-daily" | "to-calendar";
}

// Writable atom for the selected day transition state using Atom.make with initial value
export const selectedDayAtom: Atom.Writable<SelectedDayTransition | null> =
  Atom.make<SelectedDayTransition | null>(null);

// Writable atom for the month direction (-1 = prev, 0 = none, 1 = next)
export const monthDirectionAtom: Atom.Writable<MonthDirection> = Atom.make<MonthDirection>(0);

// Hook for reading the selected day transition state
export function useScheduleSelectedDay() {
  return useAtomValue(selectedDayAtom);
}

export function useSetScheduleSelectedDay() {
  return useAtomSet(selectedDayAtom);
}

// Hook for reading the month direction
export function useScheduleMonthDirection() {
  return useAtomValue(monthDirectionAtom);
}

export function useSetScheduleMonthDirection() {
  return useAtomSet(monthDirectionAtom);
}

// Hook for transition actions
export function useScheduleTransitionActions() {
  const setSelectedDay = useSetScheduleSelectedDay();
  const setMonthDirection = useSetScheduleMonthDirection();

  const startDailyTransition = useCallback(
    (day: DateTime.Zoned, sourceMonth: DateTime.Zoned) => {
      setMonthDirection(0);
      setSelectedDay({
        day,
        sourceMonth,
        phase: "to-daily",
      });
    },
    [setMonthDirection, setSelectedDay],
  );

  const startCalendarTransition = useCallback(() => {
    setMonthDirection(0);
    setSelectedDay((prev) =>
      prev === null
        ? null
        : {
            ...prev,
            phase: "to-calendar",
          },
    );
  }, [setMonthDirection, setSelectedDay]);

  const clearSelectedDay = useCallback(() => {
    setSelectedDay(null);
  }, [setSelectedDay]);

  return useMemo(
    () => ({
      startDailyTransition,
      startCalendarTransition,
      clearSelectedDay,
    }),
    [startDailyTransition, startCalendarTransition, clearSelectedDay],
  );
}

export function buildSharedDayLayoutId(day: DateTime.Zoned, displayedMonth: DateTime.Zoned) {
  return `day-${formatDayKey(day)}-${formatDayKey(DateTime.startOf(displayedMonth, "month"))}`;
}
