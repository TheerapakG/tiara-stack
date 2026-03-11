import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { DateTime, HashSet, Effect, Array } from "effect";
import { AnimatePresence, motion, useIsPresent } from "motion/react";

import { ensureResultAtomData } from "#/lib/atomRegistry";
import { useScheduledDays, scheduledDaysAtom, formatDayKey } from "#/lib/schedule";
import { getServerTimeZone, useTimeZone } from "#/hooks/useTimeZone";
import { makeZoned, useZoned } from "#/lib/date";
import {
  buildSharedDayLayoutId,
  calendarRestTransition,
  monthSlideTransition,
  morphLayoutTransition,
  useScheduleMonthDirection,
  useScheduleSelected,
  useScheduleTransitionStates,
  useSetScheduleTransitionState,
  useStartDailyTransition,
  useClearScheduleTransitionState,
} from "./-transition";

export const Route = createFileRoute(
  "/_authenticated/dashboard/guilds/$guildId/schedule/$channel/_channelLayout/calendar",
)({
  component: CalendarPage,
  ssr: "data-only", // Prevent component SSR to avoid timezone-based content flash
  loaderDeps: ({ search }) => ({ timestamp: search.timestamp }),
  loader: async ({ context, params, deps }) => {
    const timeZone = getServerTimeZone(); // Match useTimeZone behavior during SSR
    const currentDate = await Effect.runPromise(makeZoned(timeZone, deps.timestamp));

    const monthStartZoned = DateTime.startOf(currentDate, "month");
    const monthEndZoned = DateTime.endOf(currentDate, "month");
    const calendarStart = DateTime.startOf(monthStartZoned, "week", { weekStartsOn: 0 });
    const calendarEnd = DateTime.endOf(monthEndZoned, "week", { weekStartsOn: 0 });

    await Effect.runPromise(
      ensureResultAtomData(
        context.atomRegistry,
        scheduledDaysAtom({
          guildId: params.guildId,
          channel: params.channel,
          timeZone,
          rangeStart: calendarStart,
          rangeEnd: calendarEnd,
        }),
      ).pipe(Effect.catchAll(() => Effect.succeed(HashSet.empty<string>()))),
    );
  },
});

// Helper to get all days in a calendar grid (including padding days from prev/next month)
function getCalendarDays(dateTime: DateTime.Zoned) {
  const monthStart = DateTime.startOf(dateTime, "month");
  const monthEnd = DateTime.endOf(dateTime, "month");
  const calendarStart = DateTime.startOf(monthStart, "week", { weekStartsOn: 0 });
  // calendarEnd is the last moment of the day (e.g., 23:59:59.999), while current
  // starts at midnight (00:00:00) each day. This ensures the last day is included
  // regardless of whether DateTime.between is inclusive or exclusive on the maximum.
  const calendarEnd = DateTime.endOf(monthEnd, "week", { weekStartsOn: 0 });

  const days: DateTime.Zoned[] = [];
  let current = calendarStart;

  while (DateTime.between(current, { minimum: calendarStart, maximum: calendarEnd })) {
    days.push(current);
    current = DateTime.add(current, { days: 1 });
  }
  return days as [DateTime.Zoned, ...DateTime.Zoned[]];
}

// Get month name and year separately for animated display
function getMonthYearParts(dateTime: DateTime.Zoned): { month: string; year: string } {
  const parts = DateTime.toParts(dateTime);
  const monthNames = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  return { month: monthNames[parts.month - 1], year: String(parts.year) };
}

// Format day of month for display
function formatDayOfMonth(dateTime: DateTime.Zoned): string {
  const parts = DateTime.toParts(dateTime);
  return String(parts.day);
}

// Check if two dates are in the same month
function isSameMonth(a: DateTime.Zoned, b: DateTime.Zoned): boolean {
  const partsA = DateTime.toParts(a);
  const partsB = DateTime.toParts(b);
  return partsA.year === partsB.year && partsA.month === partsB.month;
}

// Inner component that handles positioning based on presence state
function SlidingTextInner({
  text,
  direction,
  exitDirectionRef,
  className,
}: {
  text: string;
  direction: -1 | 0 | 1;
  exitDirectionRef: React.RefObject<-1 | 0 | 1>;
  className?: string;
}) {
  const isPresent = useIsPresent();

  return (
    <motion.span
      initial={direction === 0 ? false : { y: direction > 0 ? "100%" : "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={
        exitDirectionRef.current === 0
          ? undefined
          : { y: exitDirectionRef.current > 0 ? "-100%" : "100%", opacity: 0 }
      }
      transition={monthSlideTransition}
      className={className}
      style={isPresent ? { display: "block" } : { position: "absolute", inset: 0 }}
    >
      {text}
    </motion.span>
  );
}

// Animated text that slides in/out when content changes
function SlidingText({
  text,
  direction,
  exitDirectionRef,
  className,
  onExitComplete,
}: {
  text: string;
  direction: -1 | 0 | 1;
  exitDirectionRef: React.RefObject<-1 | 0 | 1>;
  className?: string;
  onExitComplete?: () => void;
}) {
  return (
    <div className="relative h-[1lh] overflow-hidden">
      <AnimatePresence initial={false} mode="sync" onExitComplete={onExitComplete}>
        <SlidingTextInner
          key={text}
          text={text}
          direction={direction}
          exitDirectionRef={exitDirectionRef}
          className={className}
        />
      </AnimatePresence>
    </div>
  );
}

function DayGridPresenceShell({
  children,
  direction,
  exitDirectionRef,
}: {
  children: React.ReactNode;
  direction: -1 | 0 | 1;
  exitDirectionRef: React.RefObject<-1 | 0 | 1>;
}) {
  const isPresent = useIsPresent();

  return (
    <motion.div
      initial={
        direction === 0
          ? false
          : {
              y: direction > 0 ? "100%" : "-100%",
              opacity: 0,
            }
      }
      animate={{ y: 0, opacity: 1 }}
      exit={
        exitDirectionRef.current === 0
          ? undefined
          : {
              y: exitDirectionRef.current > 0 ? "-100%" : "100%",
              opacity: 0,
            }
      }
      transition={monthSlideTransition}
      className={isPresent ? "relative w-full" : "absolute inset-0 w-full"}
      style={{ pointerEvents: isPresent ? undefined : "none" }}
    >
      {children}
    </motion.div>
  );
}

function CalendarPage() {
  const { guildId, channel } = Route.useParams();
  const timeZone = useTimeZone();
  const search = Route.useSearch();

  const selected = useScheduleSelected();
  const monthDirection = useScheduleMonthDirection();
  const { isTransitioningToDaily, isTransitioningToCalendar, isCalendarLocked } =
    useScheduleTransitionStates();
  const setState = useSetScheduleTransitionState();
  // Use timestamp to determine the month to display
  const currentDate = useZoned(timeZone, search.timestamp);
  const currentMonthKey = formatDayKey(DateTime.startOf(currentDate, "month"));

  const exitDirectionRef = useRef<-1 | 0 | 1>(0);

  // Pre-computed timestamps for prev/next month navigation
  const prevMonthTimestamp = useMemo(
    () =>
      DateTime.toEpochMillis(
        DateTime.startOf(DateTime.subtract(currentDate, { months: 1 }), "month"),
      ),
    [currentDate],
  );
  const nextMonthTimestamp = useMemo(
    () =>
      DateTime.toEpochMillis(DateTime.startOf(DateTime.add(currentDate, { months: 1 }), "month")),
    [currentDate],
  );

  const handleMonthClick = (direction: -1 | 1) => {
    setState({ selected: undefined, phase: undefined, monthDirection: direction });
    exitDirectionRef.current = direction;
  };

  const { month, year } = getMonthYearParts(currentDate);
  const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <div className="relative overflow-hidden border border-[#33ccbb]/20 bg-[#0f1615]">
      {/* Month header: static buttons, only month/year text slides */}
      <motion.div
        initial={isTransitioningToCalendar ? { opacity: 0 } : false}
        animate={{ opacity: isTransitioningToDaily ? 0 : 1 }}
        transition={calendarRestTransition}
        style={{ pointerEvents: isCalendarLocked ? "none" : undefined }}
        className="relative z-20"
      >
        <div className="grid grid-cols-[auto_1fr_auto] items-center border-b border-[#33ccbb]/20 p-4">
          <Link
            to="."
            params={{ guildId, channel }}
            search={{ timestamp: prevMonthTimestamp }}
            onClick={() => handleMonthClick(-1)}
            className="justify-self-start p-2 text-[#33ccbb] transition-colors hover:bg-[#33ccbb]/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h3 className="flex items-center justify-center gap-2 text-center text-lg font-black tracking-tight">
            <SlidingText
              text={month}
              direction={monthDirection}
              exitDirectionRef={exitDirectionRef}
              onExitComplete={() => {
                if (monthDirection !== 0) {
                  setState((prev) => ({ ...prev, monthDirection: 0 }));
                }
              }}
            />
            <SlidingText
              text={year}
              direction={monthDirection}
              exitDirectionRef={exitDirectionRef}
            />
          </h3>
          <Link
            to="."
            params={{ guildId, channel }}
            search={{ timestamp: nextMonthTimestamp }}
            onClick={() => handleMonthClick(1)}
            className="justify-self-end p-2 text-[#33ccbb] transition-colors hover:bg-[#33ccbb]/10"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </motion.div>

      {/* Weekday header: fade only during daily nav, static during month slide */}
      <motion.div
        animate={{ opacity: isTransitioningToDaily ? 0 : 1 }}
        transition={calendarRestTransition}
        className="relative z-10 grid grid-cols-7 border-b border-[#33ccbb]/20 bg-[#0f1615]"
      >
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-3 text-center text-xs font-bold tracking-wider text-[#33ccbb]/60"
          >
            {day}
          </div>
        ))}
      </motion.div>

      <div className="relative">
        <AnimatePresence initial={false} mode="sync">
          {/* Day grid: slide up/down + cells handle morph + conditional fade */}
          <DayGridPresenceShell
            key={`grid-${currentMonthKey}`}
            direction={monthDirection}
            exitDirectionRef={exitDirectionRef}
          >
            <CalendarGrid currentDate={currentDate} selected={selected} />
          </DayGridPresenceShell>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface CalendarGridProps {
  currentDate: DateTime.Zoned;
  selected: { readonly day: DateTime.Zoned; readonly month: DateTime.Zoned } | undefined;
}

function CalendarGrid({ currentDate, selected }: CalendarGridProps) {
  const { guildId, channel } = Route.useParams();
  const timeZone = useTimeZone();
  const { isTransitioningToDaily, isTransitioningToCalendar, isCalendarLocked } =
    useScheduleTransitionStates();
  const clearScheduleTransitionState = useClearScheduleTransitionState();
  const startDailyTransition = useStartDailyTransition();

  const calendarDays = useMemo(() => {
    return getCalendarDays(currentDate);
  }, [currentDate]);

  // Get the date range for the calendar view in milliseconds
  const rangeStart = useMemo(() => Array.headNonEmpty(calendarDays), [calendarDays]);

  const rangeEnd = useMemo(
    () => DateTime.endOf(Array.lastNonEmpty(calendarDays), "day"),
    [calendarDays],
  );

  // Use derived atom to get scheduled days for the calendar view
  const scheduledDays = useScheduledDays({
    guildId,
    channel,
    timeZone,
    rangeStart,
    rangeEnd,
  });

  const currentMonth = useMemo(() => DateTime.startOf(currentDate, "month"), [currentDate]);
  const hasSelectedDayInMonth = useMemo(
    () =>
      calendarDays.some((day) => {
        return (
          selected &&
          DateTime.Equivalence(selected.day, DateTime.startOf(day, "day")) &&
          DateTime.Equivalence(selected.month, currentMonth)
        );
      }),
    [calendarDays, currentMonth, selected],
  );

  useEffect(() => {
    if (isTransitioningToCalendar && !hasSelectedDayInMonth) {
      clearScheduleTransitionState();
    }
  }, [clearScheduleTransitionState, hasSelectedDayInMonth, isTransitioningToCalendar]);

  return (
    <div
      className="grid grid-cols-7"
      style={{ pointerEvents: isCalendarLocked ? "none" : undefined }}
    >
      {calendarDays.map((day) => {
        const isCurrentMonth = isSameMonth(day, currentDate);
        const dayKey = formatDayKey(day);
        const hasSchedule = HashSet.has(scheduledDays, dayKey);
        const sharedLayoutId = buildSharedDayLayoutId(day, currentDate);
        const isSelectedDay =
          selected &&
          DateTime.Equivalence(selected.day, DateTime.startOf(day, "day")) &&
          DateTime.Equivalence(selected.month, currentMonth);

        return (
          <motion.div
            key={sharedLayoutId}
            layoutId={sharedLayoutId}
            onLayoutAnimationComplete={() => {
              if (isTransitioningToCalendar && isSelectedDay) {
                clearScheduleTransitionState();
              }
            }}
            initial={isTransitioningToCalendar && !isSelectedDay ? { opacity: 0 } : false}
            animate={{ opacity: isTransitioningToDaily && !isSelectedDay ? 0 : 1 }}
            transition={{
              ...calendarRestTransition,
              layout: morphLayoutTransition,
            }}
            style={{ pointerEvents: isCalendarLocked ? "none" : undefined }}
            className={`
              border-r border-b border-[#33ccbb]/10 last:border-r-0
              ${isCurrentMonth ? "text-white" : "text-white/30"}
              ${hasSchedule ? "bg-[#33ccbb]/5" : ""}
              ${isSelectedDay ? "relative z-20" : ""}
            `}
          >
            <Link
              to="/dashboard/guilds/$guildId/schedule/$channel/daily"
              params={{ guildId, channel }}
              search={{ timestamp: DateTime.toEpochMillis(day) }}
              onClick={() => {
                startDailyTransition(DateTime.startOf(day, "day"), currentMonth);
              }}
              className={`
                h-14 p-1 flex flex-col items-center justify-center
                transition-colors
                ${isCurrentMonth ? "hover:bg-[#33ccbb]/10" : ""}
              `}
            >
              <span className="text-sm font-medium">{formatDayOfMonth(day)}</span>
              {hasSchedule && <div className="mt-1 h-1.5 w-1.5 rounded-full bg-[#33ccbb]" />}
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
