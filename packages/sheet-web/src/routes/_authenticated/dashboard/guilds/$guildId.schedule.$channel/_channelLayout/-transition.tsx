import { DateTime } from "effect";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
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

type MonthDirection = -1 | 0 | 1;
type SelectedDayTransition = {
  dayTimestamp: number;
  sourceMonthTimestamp: number;
  phase: "to-daily" | "to-calendar";
};

const SelectedDayContext = createContext<SelectedDayTransition | null | undefined>(undefined);
const MonthDirectionContext = createContext<MonthDirection | undefined>(undefined);
const ScheduleTransitionActionsContext = createContext<
  ReturnType<typeof useScheduleTransitionActionsValue> | undefined
>(undefined);

function useScheduleTransitionActionsValue({
  setSelectedDay,
  setMonthDirectionState,
  selectedDayRef,
}: {
  setSelectedDay: Dispatch<SetStateAction<SelectedDayTransition | null>>;
  setMonthDirectionState: Dispatch<SetStateAction<MonthDirection>>;
  selectedDayRef: { current: SelectedDayTransition | null };
}) {
  const startDailyTransition = useCallback(
    (dayTimestamp: number, sourceMonthTimestamp: number) => {
      setMonthDirectionState(0);
      setSelectedDay({
        dayTimestamp,
        sourceMonthTimestamp,
        phase: "to-daily",
      });
    },
    [setMonthDirectionState, setSelectedDay],
  );

  const startCalendarTransition = useCallback(() => {
    if (selectedDayRef.current === null) {
      return;
    }

    setMonthDirectionState(0);
    setSelectedDay((current) =>
      current === null
        ? null
        : {
            ...current,
            phase: "to-calendar",
          },
    );
  }, [selectedDayRef, setMonthDirectionState, setSelectedDay]);

  const clearSelectedDay = useCallback(() => {
    setSelectedDay(null);
  }, [setSelectedDay]);

  return useMemo(
    () => ({
      setMonthDirection: setMonthDirectionState,
      startDailyTransition,
      startCalendarTransition,
      clearSelectedDay,
    }),
    [clearSelectedDay, setMonthDirectionState, startCalendarTransition, startDailyTransition],
  );
}

export function ScheduleTransitionProvider({ children }: { children: ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<SelectedDayTransition | null>(null);
  const [monthDirection, setMonthDirectionState] = useState<MonthDirection>(0);
  const selectedDayRef = useRef(selectedDay);
  selectedDayRef.current = selectedDay;
  const actions = useScheduleTransitionActionsValue({
    setSelectedDay,
    setMonthDirectionState,
    selectedDayRef,
  });

  return (
    <ScheduleTransitionActionsContext.Provider value={actions}>
      <SelectedDayContext.Provider value={selectedDay}>
        <MonthDirectionContext.Provider value={monthDirection}>
          {children}
        </MonthDirectionContext.Provider>
      </SelectedDayContext.Provider>
    </ScheduleTransitionActionsContext.Provider>
  );
}

export function useScheduleSelectedDay() {
  const context = useContext(SelectedDayContext);

  if (context === undefined) {
    throw new Error("useScheduleSelectedDay must be used inside ScheduleTransitionProvider");
  }

  return context;
}

export function useScheduleMonthDirection() {
  const context = useContext(MonthDirectionContext);

  if (context === undefined) {
    throw new Error("useScheduleMonthDirection must be used inside ScheduleTransitionProvider");
  }

  return context;
}

export function useScheduleTransitionActions() {
  const context = useContext(ScheduleTransitionActionsContext);

  if (context === undefined) {
    throw new Error("useScheduleTransitionActions must be used inside ScheduleTransitionProvider");
  }

  return context;
}

export function getMonthTimestamp(dateTime: DateTime.Zoned) {
  return DateTime.toEpochMillis(DateTime.startOf(dateTime, "month"));
}

export function buildSharedDayLayoutId(day: DateTime.Zoned, displayedMonth: DateTime.Zoned) {
  return `day-${formatDayKey(day)}-${formatDayKey(DateTime.startOf(displayedMonth, "month"))}`;
}
