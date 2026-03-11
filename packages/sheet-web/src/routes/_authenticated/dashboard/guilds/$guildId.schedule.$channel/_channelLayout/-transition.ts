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

export type TransitionPhase = "to-daily" | "to-calendar";

export interface ScheduleTransitionState {
  readonly selected?: {
    readonly day: DateTime.Zoned;
    readonly month: DateTime.Zoned;
  };
  readonly phase?: TransitionPhase;
  readonly monthDirection: MonthDirection;
}

// Combined singular atom for all schedule transition state
const scheduleTransitionAtom: Atom.Writable<ScheduleTransitionState> =
  Atom.make<ScheduleTransitionState>({
    selected: undefined,
    phase: undefined,
    monthDirection: 0,
  });

// Derived atom for the selected day
export const selectedAtom: Atom.Atom<
  | {
      readonly day: DateTime.Zoned;
      readonly month: DateTime.Zoned;
    }
  | undefined
> = Atom.map(scheduleTransitionAtom, (state) => state.selected);

// Derived atom for the phase
export const phaseAtom: Atom.Atom<TransitionPhase | undefined> = Atom.map(
  scheduleTransitionAtom,
  (state) => state.phase,
);

// Derived atom for month direction
export const monthDirectionAtom: Atom.Atom<MonthDirection> = Atom.map(
  scheduleTransitionAtom,
  (state) => state.monthDirection,
);

// Derived atom for checking if transitioning to daily view
export const isTransitioningToDailyAtom: Atom.Atom<boolean> = Atom.map(
  scheduleTransitionAtom,
  (state) => state.phase === "to-daily",
);

// Derived atom for checking if transitioning to calendar view
export const isTransitioningToCalendarAtom: Atom.Atom<boolean> = Atom.map(
  scheduleTransitionAtom,
  (state) => state.phase === "to-calendar",
);

// Derived atom for calendar locked state (transitioning in either direction)
export const isCalendarLockedAtom: Atom.Atom<boolean> = Atom.map(
  scheduleTransitionAtom,
  (state) => state.phase === "to-daily" || state.phase === "to-calendar",
);

// Hook for reading the selected day transition state
export function useScheduleSelected() {
  return useAtomValue(selectedAtom);
}

// Hook for reading the phase
export function useSchedulePhase() {
  return useAtomValue(phaseAtom);
}

// Hook for setting the schedule transition state (operates on combined atom)
export function useSetScheduleTransitionState() {
  return useAtomSet(scheduleTransitionAtom);
}

// Hook for reading the month direction
export function useScheduleMonthDirection() {
  return useAtomValue(monthDirectionAtom);
}

// Hook for setting month direction
export function useSetScheduleMonthDirection() {
  const setState = useSetScheduleTransitionState();
  return useCallback(
    (direction: MonthDirection) => {
      setState((prev) => ({ ...prev, monthDirection: direction }));
    },
    [setState],
  );
}

// Hook for starting daily transition
export function useStartDailyTransition() {
  const setState = useSetScheduleTransitionState();
  return useCallback(
    (day: DateTime.Zoned, month: DateTime.Zoned) => {
      setState({
        selected: { day, month },
        phase: "to-daily",
        monthDirection: 0,
      });
    },
    [setState],
  );
}

// Hook for starting calendar transition
export function useStartCalendarTransition() {
  const setState = useSetScheduleTransitionState();
  return useCallback(() => {
    setState((prev) =>
      prev.selected !== undefined
        ? {
            ...prev,
            phase: "to-calendar",
            monthDirection: 0,
          }
        : prev,
    );
  }, [setState]);
}

// Hook for clearing schedule transition state
export function useClearScheduleTransitionState() {
  const setState = useSetScheduleTransitionState();
  return useCallback(() => {
    setState({
      selected: undefined,
      phase: undefined,
      monthDirection: 0,
    });
  }, [setState]);
}

// Combined hook for transition actions (for convenience)
export function useScheduleTransitionActions() {
  const startDailyTransition = useStartDailyTransition();
  const startCalendarTransition = useStartCalendarTransition();
  const clearScheduleTransitionState = useClearScheduleTransitionState();

  return useMemo(
    () => ({
      startDailyTransition,
      startCalendarTransition,
      clearScheduleTransitionState,
    }),
    [startDailyTransition, startCalendarTransition, clearScheduleTransitionState],
  );
}

// Hook for derived transition states
export function useScheduleTransitionStates() {
  const isTransitioningToDaily = useAtomValue(isTransitioningToDailyAtom);
  const isTransitioningToCalendar = useAtomValue(isTransitioningToCalendarAtom);
  const isCalendarLocked = useAtomValue(isCalendarLockedAtom);

  return useMemo(
    () => ({
      isTransitioningToDaily,
      isTransitioningToCalendar,
      isCalendarLocked,
    }),
    [isTransitioningToDaily, isTransitioningToCalendar, isCalendarLocked],
  );
}

export function buildSharedDayLayoutId(day: DateTime.Zoned, displayedMonth: DateTime.Zoned) {
  return `day-${formatDayKey(day)}-${formatDayKey(DateTime.startOf(displayedMonth, "month"))}`;
}
