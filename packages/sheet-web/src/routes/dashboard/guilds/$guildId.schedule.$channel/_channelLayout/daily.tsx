import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMemo, useRef, useState, useEffect, Suspense } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DateTime, Option, Effect } from "effect";
import { Registry } from "@effect-atom/atom-react";
import {
  type SchedulePlayer,
  type ScheduleResult,
  guildScheduleAtom,
  useGuildSchedule,
  formatDayKey,
  computeScheduleDateTime,
} from "#/lib/schedule";
import { Sheet } from "sheet-apis/schema";
import { eventConfigAtom, useEventConfig } from "#/lib/sheet";
import { useTimeZone } from "#/hooks/useTimeZone";
import { useZoned } from "#/lib/date";

export const Route = createFileRoute(
  "/dashboard/guilds/$guildId/schedule/$channel/_channelLayout/daily",
)({
  component: DailyPage,
  ssr: "data-only",
  loader: async ({ context, params }) => {
    await Effect.runPromise(
      Effect.all(
        [
          Registry.getResult(context.atomRegistry, guildScheduleAtom(params.guildId)),
          Registry.getResult(context.atomRegistry, eventConfigAtom(params.guildId)),
        ],
        { concurrency: "unbounded" },
      ),
    );
  },
});

function DailyPage() {
  return (
    <div className="border border-[#33ccbb]/20 bg-[#0a0f0e]">
      {/* Header */}
      <DailyHeader />

      {/* Schedule with Virtual Scroll */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-white/60 font-medium tracking-wide">LOADING SCHEDULE...</div>
          </div>
        }
      >
        <DailyScheduleContent />
      </Suspense>
    </div>
  );
}

// Header component
function DailyHeader() {
  const { channel, guildId } = Route.useParams();
  const search = Route.useSearch();
  const timeZone = useTimeZone();
  const currentDate = useZoned(timeZone, search.timestamp);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#33ccbb]/20 bg-[#0f1615]">
      <Link
        className="flex items-center gap-2 text-[#33ccbb] hover:text-white transition-colors"
        to="/dashboard/guilds/$guildId/schedule/$channel/calendar"
        params={{ guildId, channel }}
        search={{ timestamp: DateTime.toEpochMillis(DateTime.startOf(currentDate, "month")) }}
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm font-bold tracking-wide">BACK TO CALENDAR</span>
      </Link>
      <h3 className="text-lg font-black tracking-tight text-white">
        {formatFullDate(currentDate)}
      </h3>
    </div>
  );
}

// Main content - loads data and renders infinite scroll
function DailyScheduleContent() {
  const { channel, guildId } = Route.useParams();
  const timeZone = useTimeZone();
  const search = Route.useSearch();
  const parentRef = useRef<HTMLDivElement>(null);

  const currentDate = useZoned(timeZone, search.timestamp);

  // Load schedules and eventConfig
  const allSchedules = useGuildSchedule(guildId);
  const eventConfig = useEventConfig(guildId);
  const startTimeZoned = useZoned(timeZone, DateTime.toEpochMillis(eventConfig.startTime));

  // Filter schedules by channel
  const channelSchedules = useMemo(() => {
    return allSchedules.filter((schedule) =>
      schedule._tag === "PopulatedSchedule"
        ? schedule.channel === channel && schedule.visible
        : schedule._tag === "PopulatedBreakSchedule" && schedule.channel === channel,
    );
  }, [allSchedules, channel]);

  // Group schedules by actual date (not schedule day)
  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, { date: DateTime.Zoned; schedules: ScheduleResult[] }>();

    channelSchedules.forEach((schedule) => {
      const scheduleDateTime = computeScheduleDateTime(startTimeZoned, schedule.hour);
      const dateKey = formatDayKey(scheduleDateTime);

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, { date: scheduleDateTime, schedules: [] });
      }
      grouped.get(dateKey)!.schedules.push(schedule);
    });

    return grouped;
  }, [channelSchedules, startTimeZoned]);

  // Get sorted date keys
  const sortedDateKeys = useMemo(() => {
    return globalThis.Array.from(schedulesByDate.keys()).sort();
  }, [schedulesByDate]);

  // Calculate day offsets for current date
  const currentDateKey = formatDayKey(currentDate);
  const currentDateIndex = sortedDateKeys.findIndex((key: string) => key === currentDateKey);

  // If current date has no schedules, find nearest date
  const targetIndex = useMemo(() => {
    if (currentDateIndex >= 0) return currentDateIndex;
    // Find the closest date
    const currentMs = DateTime.toEpochMillis(currentDate);
    let closestIndex = 0;
    let closestDiff = Infinity;
    sortedDateKeys.forEach((key: string, idx: number) => {
      const date = schedulesByDate.get(key)!.date;
      const diff = Math.abs(DateTime.toEpochMillis(date) - currentMs);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = idx;
      }
    });
    return closestIndex;
  }, [currentDateIndex, sortedDateKeys, schedulesByDate, currentDate]);

  // Infinite scroll state
  const [dayRange, setDayRange] = useState({ startOffset: -10, endOffset: 10 });

  // Generate virtual days based on range around target
  const virtualDays = useMemo(() => {
    const startIdx = Math.max(0, targetIndex + dayRange.startOffset);
    const endIdx = Math.min(sortedDateKeys.length - 1, targetIndex + dayRange.endOffset);

    const days: { dateKey: string; date: DateTime.Zoned; schedules: ScheduleResult[] }[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const key = sortedDateKeys[i];
      const data = schedulesByDate.get(key)!;
      days.push({ dateKey: key, date: data.date, schedules: data.schedules });
    }
    return days;
  }, [sortedDateKeys, schedulesByDate, targetIndex, dayRange]);

  const virtualizer = useVirtualizer({
    count: virtualDays.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400,
    overscan: 5,
  });

  // Scroll to current/target date on mount
  useEffect(() => {
    const targetVirtualIndex = virtualDays.findIndex(
      (d) => d.dateKey === sortedDateKeys[targetIndex],
    );
    if (targetVirtualIndex >= 0) {
      virtualizer.scrollToIndex(targetVirtualIndex, { align: "start" });
    }
  }, [targetIndex, sortedDateKeys, virtualDays, virtualizer]);

  // Extend range when scrolling near edges (bidirectional infinite scroll)
  useEffect(() => {
    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const [lastItem] = [...virtualItems].reverse();
    const firstItem = virtualItems[0];

    // Extend backward when scrolling near the top
    if (firstItem.index < 3) {
      setDayRange((prev) => ({
        ...prev,
        startOffset: Math.max(-targetIndex, prev.startOffset - 10),
      }));
    }

    // Extend forward when scrolling near the bottom
    if (lastItem.index >= virtualDays.length - 3) {
      setDayRange((prev) => ({
        ...prev,
        endOffset: Math.min(sortedDateKeys.length - 1 - targetIndex, prev.endOffset + 10),
      }));
    }
  }, [virtualizer.getVirtualItems(), virtualDays.length, targetIndex, sortedDateKeys.length]);

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const dayData = virtualDays[virtualItem.index];
          const isActive = dayData.dateKey === currentDateKey;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <DayBlock
                schedules={dayData.schedules}
                isActive={isActive}
                startTime={startTimeZoned}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Individual Day Block - Shows unified timeline with both schedule and actual date perspectives
interface DayBlockProps {
  schedules: ScheduleResult[];
  isActive: boolean;
  startTime: DateTime.Zoned;
}

function DayBlock({ schedules, isActive, startTime }: DayBlockProps) {
  // Group schedules by hour
  const schedulesByHour = useMemo(() => {
    const grouped = new Map<number, ScheduleResult[]>();
    schedules.forEach((schedule) => {
      const hour = Option.getOrElse(schedule.hour, () => 0);
      if (!grouped.has(hour)) {
        grouped.set(hour, []);
      }
      grouped.get(hour)!.push(schedule);
    });
    return grouped;
  }, [schedules]);

  // Get all unique hours for this date, sorted
  const sortedHours = useMemo(() => {
    return globalThis.Array.from(schedulesByHour.keys()).sort((a: number, b: number) => a - b);
  }, [schedulesByHour]);

  return (
    <div className={`border-b border-[#33ccbb]/30 ${isActive ? "bg-[#0f1615]" : "bg-[#0a0f0e]"}`}>
      {/* Schedule Rows - Each row shows one schedule hour with both perspectives */}
      <div>
        {sortedHours.map((scheduleHour: number, index: number) => {
          const hourSchedules = schedulesByHour.get(scheduleHour) ?? [];
          const isBreak = hourSchedules.some((s) => s._tag === "PopulatedBreakSchedule");

          // Calculate actual date for this schedule hour
          const actualDateTime = computeScheduleDateTime(startTime, Option.some(scheduleHour));
          const actualDateParts = DateTime.toParts(actualDateTime);

          // Calculate schedule day
          const scheduleDay = Math.floor(scheduleHour / 24) + 1;
          const prevScheduleDay =
            index > 0 ? Math.floor(sortedHours[index - 1] / 24) + 1 : scheduleDay;
          const isScheduleDayBoundary = scheduleDay !== prevScheduleDay || index === 0;

          // Check if actual date boundary
          const prevActualDateParts =
            index > 0
              ? DateTime.toParts(
                  computeScheduleDateTime(startTime, Option.some(sortedHours[index - 1])),
                )
              : actualDateParts;
          const isActualDateBoundary =
            actualDateParts.day !== prevActualDateParts.day ||
            actualDateParts.month !== prevActualDateParts.month ||
            index === 0;

          return (
            <div
              key={scheduleHour}
              className={`grid grid-cols-[140px_1fr] border-b border-[#33ccbb]/10 last:border-b-0 ${
                isBreak ? "opacity-40" : ""
              }`}
            >
              {/* Left Side - Schedule Day + Hour */}
              <div
                className={`border-r border-[#33ccbb]/10 p-3 flex flex-col items-end justify-center bg-[#0f1615]/50 ${
                  isScheduleDayBoundary ? "border-t-2 border-t-[#33ccbb]/40" : ""
                }`}
              >
                {isScheduleDayBoundary && (
                  <span className="text-[10px] font-bold text-[#33ccbb]/60 uppercase tracking-wider mb-0.5">
                    Day {scheduleDay}
                  </span>
                )}
                <span className="text-sm font-bold text-[#33ccbb]/80 tabular-nums">
                  {scheduleHour}
                </span>
              </div>

              {/* Right Side - Actual Date + Hour */}
              <div
                className={`p-3 min-h-[44px] flex items-center gap-4 ${
                  isActualDateBoundary ? "border-t-2 border-t-[#33ccbb]/40" : ""
                }`}
              >
                {/* Actual Date Marker */}
                <div className="flex-shrink-0 w-20">
                  {isActualDateBoundary ? (
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-white tabular-nums">
                        {actualDateParts.day}
                      </span>
                      <span className="text-[10px] font-bold text-[#33ccbb] uppercase tracking-wider">
                        {formatShortMonth(actualDateParts.month)} {actualDateParts.year}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-white/40 tabular-nums">
                      {String(actualDateParts.hours).padStart(2, "0")}:00
                    </span>
                  )}
                </div>

                {/* Schedule Content */}
                <div className="flex-1">
                  {isBreak ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#33ccbb]/30" />
                      <span className="text-sm text-white/40 font-medium italic">Break</span>
                    </div>
                  ) : hourSchedules.length > 0 ? (
                    <div className="space-y-2">
                      {hourSchedules
                        .filter((s): s is Sheet.PopulatedSchedule => s._tag === "PopulatedSchedule")
                        .map((schedule, idx) => (
                          <ScheduleRow key={idx} schedule={schedule} />
                        ))}
                    </div>
                  ) : (
                    <div className="h-full" />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {sortedHours.length === 0 && (
          <div className="grid grid-cols-[140px_1fr]">
            <div className="border-r border-[#33ccbb]/10 p-3 bg-[#0f1615]/50" />
            <div className="p-6 text-center">
              <span className="text-sm text-white/30 italic">No schedules</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Schedule Row Component - Shows only Fillers (callers must filter out break schedules)
function ScheduleRow({ schedule }: { schedule: Sheet.PopulatedSchedule }) {
  const fills = schedule.fills.filter(Option.isSome).map((f: { value: SchedulePlayer }) => f.value);

  if (fills.length === 0) {
    return <div className="h-full" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {fills.map((fill: SchedulePlayer, idx: number) => (
        <PlayerBadge key={idx} player={fill} />
      ))}
    </div>
  );
}

// Player Badge Component
function PlayerBadge({ player }: { player: SchedulePlayer }) {
  return (
    <span className={`text-xs ${player.enc ? "font-bold text-white" : "text-white/80"}`}>
      {player.player.name}
    </span>
  );
}

// Helper functions
function formatFullDate(dateTime: DateTime.Zoned): string {
  const parts = DateTime.toParts(dateTime);
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
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
  return `${dayNames[parts.weekDay]}, ${monthNames[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

function formatShortMonth(month: number): string {
  const monthNames = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return monthNames[month - 1];
}
