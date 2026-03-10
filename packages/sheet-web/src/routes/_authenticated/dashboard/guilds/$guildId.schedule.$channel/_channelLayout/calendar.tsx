import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  getMonthTimestamp,
  monthSlideTransition,
  morphLayoutTransition,
  useScheduleMonthDirection,
  useScheduleSelectedDay,
  useScheduleTransitionActions,
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

// Format month/year for display (e.g., "FEBRUARY 2026")
function formatMonthYear(dateTime: DateTime.Zoned): string {
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
  return `${monthNames[parts.month - 1]} ${parts.year}`;
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

function MonthPresenceShell({
  children,
  direction,
  exitDirectionRef,
}: {
  children: React.ReactNode;
  direction: -1 | 0 | 1;
  exitDirectionRef: React.MutableRefObject<-1 | 0 | 1>;
}) {
  const isPresent = useIsPresent();

  return (
    <motion.div
      initial={
        direction === 0
          ? false
          : {
              x: direction > 0 ? "100%" : "-100%",
              opacity: 0,
            }
      }
      animate={{ x: 0, opacity: 1 }}
      exit={
        exitDirectionRef.current === 0
          ? undefined
          : {
              x: exitDirectionRef.current > 0 ? "-100%" : "100%",
              opacity: 0,
            }
      }
      transition={monthSlideTransition}
      className={isPresent ? "relative z-20 w-full" : "absolute inset-0 z-20 w-full"}
      style={{ pointerEvents: isPresent ? undefined : "none" }}
    >
      {children}
    </motion.div>
  );
}

function DayGridPresenceShell({
  children,
  direction,
  exitDirectionRef,
}: {
  children: React.ReactNode;
  direction: -1 | 0 | 1;
  exitDirectionRef: React.MutableRefObject<-1 | 0 | 1>;
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
  const navigate = useNavigate();
  const selectedDay = useScheduleSelectedDay();
  const monthDirection = useScheduleMonthDirection();
  const { clearSelectedDay, setMonthDirection } = useScheduleTransitionActions();
  // Use timestamp to determine the month to display
  const currentDate = useZoned(timeZone, search.timestamp);
  const currentMonthKey = formatDayKey(DateTime.startOf(currentDate, "month"));
  const isTransitioningToDaily = selectedDay?.phase === "to-daily";
  const isReturningToCalendar = selectedDay?.phase === "to-calendar";
  const isCalendarLocked = isTransitioningToDaily || isReturningToCalendar;

  const exitDirectionRef = useRef<-1 | 0 | 1>(0);

  const navigateMonth = (direction: -1 | 1) => {
    const nextMonthZoned =
      direction < 0
        ? DateTime.subtract(currentDate, { months: 1 })
        : DateTime.add(currentDate, { months: 1 });
    const nextMonthStartZoned = DateTime.startOf(nextMonthZoned, "month");

    clearSelectedDay();
    exitDirectionRef.current = direction;
    setMonthDirection(direction);

    navigate({
      to: ".",
      params: { guildId, channel },
      search: {
        timestamp: DateTime.toEpochMillis(nextMonthStartZoned),
      },
    });
  };

  const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <div className="relative overflow-hidden border border-[#33ccbb]/20 bg-[#0f1615]">
      <div className="relative">
        <AnimatePresence initial={false} mode="sync">
          {/* Month header: slide left/right + fade during daily nav */}
          <MonthPresenceShell
            key={`header-${currentMonthKey}`}
            direction={monthDirection}
            exitDirectionRef={exitDirectionRef}
          >
            <motion.div
              initial={isReturningToCalendar ? { opacity: 0 } : false}
              animate={{ opacity: isTransitioningToDaily ? 0 : 1 }}
              transition={calendarRestTransition}
              style={{ pointerEvents: isCalendarLocked ? "none" : undefined }}
            >
              <div className="grid grid-cols-[auto_1fr_auto] items-center border-b border-[#33ccbb]/20 p-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="justify-self-start p-2 text-[#33ccbb] transition-colors hover:bg-[#33ccbb]/10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="text-center text-lg font-black tracking-tight">
                  {formatMonthYear(currentDate)}
                </h3>
                <button
                  onClick={() => navigateMonth(1)}
                  className="justify-self-end p-2 text-[#33ccbb] transition-colors hover:bg-[#33ccbb]/10"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          </MonthPresenceShell>
        </AnimatePresence>
      </div>

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
            <CalendarGrid currentDate={currentDate} />
          </DayGridPresenceShell>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface CalendarGridProps {
  currentDate: DateTime.Zoned;
}

function CalendarGrid({ currentDate }: CalendarGridProps) {
  const { guildId, channel } = Route.useParams();
  const timeZone = useTimeZone();
  const selectedDay = useScheduleSelectedDay();
  const { clearSelectedDay, startDailyTransition } = useScheduleTransitionActions();

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

  const currentMonthTimestamp = getMonthTimestamp(currentDate);
  const isTransitioningToDaily = selectedDay?.phase === "to-daily";
  const isReturningToCalendar = selectedDay?.phase === "to-calendar";
  const isCalendarLocked = isTransitioningToDaily || isReturningToCalendar;
  const hasSelectedDayInMonth = useMemo(
    () =>
      calendarDays.some((day) => {
        const dayTimestamp = DateTime.toEpochMillis(DateTime.startOf(day, "day"));

        return (
          selectedDay?.dayTimestamp === dayTimestamp &&
          selectedDay?.sourceMonthTimestamp === currentMonthTimestamp
        );
      }),
    [calendarDays, currentMonthTimestamp, selectedDay],
  );

  useEffect(() => {
    if (isReturningToCalendar && !hasSelectedDayInMonth) {
      clearSelectedDay();
    }
  }, [clearSelectedDay, hasSelectedDayInMonth, isReturningToCalendar]);

  return (
    <div
      className="grid grid-cols-7"
      style={{ pointerEvents: isCalendarLocked ? "none" : undefined }}
    >
      {calendarDays.map((day) => {
        const isCurrentMonth = isSameMonth(day, currentDate);
        const dayKey = formatDayKey(day);
        const hasSchedule = HashSet.has(scheduledDays, dayKey);
        const dayTimestamp = DateTime.toEpochMillis(DateTime.startOf(day, "day"));
        const sharedLayoutId = buildSharedDayLayoutId(day, currentDate);
        const isSelectedDay =
          selectedDay?.dayTimestamp === dayTimestamp &&
          selectedDay?.sourceMonthTimestamp === currentMonthTimestamp;

        return (
          <motion.div
            key={sharedLayoutId}
            layoutId={sharedLayoutId}
            onLayoutAnimationComplete={() => {
              if (isReturningToCalendar && isSelectedDay) {
                clearSelectedDay();
              }
            }}
            initial={isReturningToCalendar && !isSelectedDay ? { opacity: 0 } : false}
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
              search={{ timestamp: dayTimestamp }}
              onClick={() => {
                startDailyTransition(dayTimestamp, currentMonthTimestamp);
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
