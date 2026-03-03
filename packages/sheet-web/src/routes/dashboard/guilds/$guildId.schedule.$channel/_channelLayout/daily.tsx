import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMemo, useRef, useState, useEffect, Suspense } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DateTime, Option, Effect, pipe, HashMap, Array, Duration, Number } from "effect";
import { Registry } from "@effect-atom/atom-react";
import {
  type SchedulePlayer,
  guildScheduleAtom,
  useGuildSchedule,
  computeScheduleDateTime,
  formatDayKey,
} from "#/lib/schedule";
import { Sheet } from "sheet-apis/schema";
import { eventConfigAtom, useEventConfig } from "#/lib/sheet";
import { useTimeZone } from "#/hooks/useTimeZone";
import { useZoned } from "#/lib/date";

// Virtualizer constants
const ESTIMATE_SIZE = 400;
const INITIAL_START_OFFSET = -10;
const INITIAL_END_OFFSET = 10;

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

  // Filter schedules by channel (PopulatedSchedule only; break schedules excluded)
  const channelSchedules = useMemo(
    () =>
      allSchedules.filter(
        (s): s is Sheet.PopulatedSchedule =>
          s._tag === "PopulatedSchedule" && s.channel === channel && s.visible,
      ),
    [allSchedules, channel],
  );

  // Group schedules by date -> DateTime -> PopulatedSchedule[]
  const schedulesByDate = useMemo(() => {
    return pipe(
      channelSchedules,
      Array.reduce(
        HashMap.empty<DateTime.Zoned, HashMap.HashMap<DateTime.Zoned, Sheet.PopulatedSchedule[]>>(),
        (acc, schedule) => {
          const scheduleDateTime = computeScheduleDateTime(startTimeZoned, schedule.hour);
          const dateKey = DateTime.startOf(scheduleDateTime, "day");

          return HashMap.modifyAt(
            acc,
            dateKey,
            Option.match({
              onSome: (existingHourMap) =>
                Option.some(
                  HashMap.modifyAt(
                    existingHourMap,
                    scheduleDateTime,
                    Option.match({
                      onSome: (value) => Option.some([...value, schedule]),
                      onNone: () => Option.some([schedule]),
                    }),
                  ),
                ),
              onNone: () => Option.some(HashMap.make([scheduleDateTime, [schedule]])),
            }),
          );
        },
      ),
    );
  }, [channelSchedules, startTimeZoned]);

  const currentDateKey = useMemo(() => DateTime.startOf(currentDate, "day"), [currentDate]);

  // Infinite scroll state
  const [dayOffsetRange, setDayOffsetRange] = useState({
    startOffset: INITIAL_START_OFFSET,
    endOffset: INITIAL_END_OFFSET,
  });

  // Generate virtual days based on range around target
  const virtualDays = useMemo(() => {
    const dayOffsetArray = Array.range(dayOffsetRange.startOffset, dayOffsetRange.endOffset);

    return Array.map(dayOffsetArray, (dayOffset) => {
      const dateKey = DateTime.startOf(
        dayOffset >= 0
          ? DateTime.addDuration(currentDateKey, Duration.days(dayOffset))
          : DateTime.subtractDuration(currentDateKey, Duration.days(-dayOffset)),
        "day",
      );
      const data = HashMap.get(schedulesByDate, dateKey);
      const schedulesByDateTime = Option.getOrElse(data, () =>
        HashMap.empty<DateTime.Zoned, Sheet.PopulatedSchedule[]>(),
      );

      return { dateKey, schedulesByDateTime };
    });
  }, [dayOffsetRange, currentDateKey, schedulesByDate]);

  const virtualizer = useVirtualizer({
    count: virtualDays.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => formatDayKey(virtualDays[index].dateKey),
    estimateSize: () => ESTIMATE_SIZE,
    initialOffset: -INITIAL_START_OFFSET * ESTIMATE_SIZE,
    overscan: 3,
  });

  // Extend range when scrolling near edges (bidirectional infinite scroll)
  useEffect(() => {
    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const firstItem = Array.head(virtualItems);
    const lastItem = Array.last(virtualItems);

    // Extend backward when scrolling near the top
    if (Option.isSome(firstItem) && firstItem.value.index < 3) {
      setDayOffsetRange((prev) => ({
        ...prev,
        startOffset: prev.startOffset + INITIAL_START_OFFSET,
      }));
    }

    // Extend forward when scrolling near the bottom
    if (Option.isSome(lastItem) && lastItem.value.index >= virtualDays.length - 3) {
      setDayOffsetRange((prev) => ({
        ...prev,
        endOffset: prev.endOffset + INITIAL_END_OFFSET,
      }));
    }
  }, [virtualizer.getVirtualItems(), virtualDays.length]);

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
          const isActive = DateTime.Equivalence(dayData.dateKey, currentDateKey);

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
              <DateBlock
                date={dayData.dateKey}
                schedulesByDateTime={dayData.schedulesByDateTime}
                isActive={isActive}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Break Row Component - Full row for break hours
interface BreakRowProps {
  dateHour: number;
  dateTimeParts: DateTime.DateTime.Parts;
  isDateTimeBoundary: boolean;
}

function BreakRow({ dateHour, dateTimeParts, isDateTimeBoundary }: BreakRowProps) {
  return (
    <div className="grid grid-cols-[140px_1fr] border-b border-[#33ccbb]/10 last:border-b-0 opacity-40">
      {/* Left Side - Hour */}
      <div
        className={`border-r border-[#33ccbb]/10 p-3 flex flex-col items-end justify-center bg-[#0f1615]/50 ${
          isDateTimeBoundary ? "border-t-2 border-t-[#33ccbb]/40" : ""
        }`}
      >
        <span className="text-sm font-bold text-[#33ccbb]/80 tabular-nums">{dateHour}</span>
      </div>

      {/* Right Side - Date + Break */}
      <div
        className={`p-3 min-h-[44px] flex items-center gap-4 ${
          isDateTimeBoundary ? "border-t-2 border-t-[#33ccbb]/40" : ""
        }`}
      >
        {/* Actual Date Marker */}
        <div className="flex-shrink-0 w-20">
          {isDateTimeBoundary ? (
            <div className="flex flex-col">
              <span className="text-xs font-black text-white tabular-nums">
                {dateTimeParts.day}
              </span>
              <span className="text-[10px] font-bold text-[#33ccbb] uppercase tracking-wider">
                {formatShortMonth(dateTimeParts.month)} {dateTimeParts.year}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold text-white/40 tabular-nums">
              {String(dateTimeParts.hours).padStart(2, "0")}:00
            </span>
          )}
        </div>

        {/* Break Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#33ccbb]/30" />
            <span className="text-sm text-white/40 font-medium italic">Break</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Schedule Row Component - Full row for schedule hours
interface ScheduleHourRowProps {
  schedules: Array.NonEmptyReadonlyArray<Sheet.PopulatedSchedule>;
  previousSchedules: Sheet.PopulatedSchedule[];
  dateTimeParts: DateTime.DateTime.Parts;
  isDateTimeBoundary: boolean;
}

function ScheduleHourRow({
  schedules,
  previousSchedules,
  dateTimeParts,
  isDateTimeBoundary,
}: ScheduleHourRowProps) {
  const firstSchedule = Array.headNonEmpty(schedules);
  const scheduleDay = firstSchedule.day;
  const scheduleHour = firstSchedule.hour;
  const previousScheduleDay = Option.map(Array.head(previousSchedules), (s) => s.day);
  const isScheduleDayBoundary = !Option.getEquivalence(Number.Equivalence)(
    Option.some(scheduleDay),
    previousScheduleDay,
  );

  return (
    <div className="grid grid-cols-[140px_1fr] border-b border-[#33ccbb]/10 last:border-b-0">
      {/* Left Side - Schedule Day + Hour */}
      <div
        className={`border-r border-[#33ccbb]/10 p-3 flex flex-col items-end justify-center bg-[#0f1615]/50 ${
          isDateTimeBoundary ? "border-t-2 border-t-[#33ccbb]/40" : ""
        }`}
      >
        {isScheduleDayBoundary && (
          <span className="text-[10px] font-bold text-[#33ccbb]/60 uppercase tracking-wider mb-0.5">
            Day {scheduleDay}
          </span>
        )}
        <span className="text-sm font-bold text-[#33ccbb]/80 tabular-nums">
          {Option.getOrElse(scheduleHour, () => "??")}
        </span>
      </div>

      {/* Right Side - Actual Date + Hour */}
      <div
        className={`p-3 min-h-[44px] flex items-center gap-4 ${
          isDateTimeBoundary ? "border-t-2 border-t-[#33ccbb]/40" : ""
        }`}
      >
        {/* Actual Date Marker */}
        <div className="flex-shrink-0 w-20">
          {isDateTimeBoundary ? (
            <div className="flex flex-col">
              <span className="text-xs font-black text-white tabular-nums">
                {dateTimeParts.day}
              </span>
              <span className="text-[10px] font-bold text-[#33ccbb] uppercase tracking-wider">
                {formatShortMonth(dateTimeParts.month)} {dateTimeParts.year}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold text-white/40 tabular-nums">
              {String(dateTimeParts.hours).padStart(2, "0")}:00
            </span>
          )}
        </div>

        {/* Schedule Content */}
        <div className="flex-1 space-y-2">
          {schedules.map((schedule, idx) => (
            <ScheduleRow key={idx} schedule={schedule} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Individual Day Block - Shows unified timeline with both schedule and actual date perspectives
interface DateBlockProps {
  date: DateTime.Zoned;
  schedulesByDateTime: HashMap.HashMap<DateTime.Zoned, Sheet.PopulatedSchedule[]>;
  isActive: boolean;
}

// Row data discriminated union
type RowData =
  | {
      type: "break";
      key: number;
      dateHour: number;
      dateTimeParts: DateTime.DateTime.Parts;
      isDateTimeBoundary: boolean;
    }
  | {
      type: "schedule";
      key: number;
      schedules: Array.NonEmptyReadonlyArray<Sheet.PopulatedSchedule>;
      previousSchedules: Sheet.PopulatedSchedule[];
      dateTimeParts: DateTime.DateTime.Parts;
      isDateTimeBoundary: boolean;
    };

function DateBlock({ date, schedulesByDateTime, isActive }: DateBlockProps) {
  // Build rows using reduce to track last non-empty schedules for proper day boundary detection
  const rows = useMemo(
    () =>
      pipe(
        Array.range(0, 23),
        Array.reduce(
          { lastNonEmpty: [] as Sheet.PopulatedSchedule[], rows: [] as RowData[] },
          (acc, dateHour, index) => {
            const dateTimeHour = DateTime.addDuration(date, Duration.hours(dateHour));
            const hourSchedules = Option.getOrElse(
              HashMap.get(schedulesByDateTime, dateTimeHour),
              () => [],
            );
            const dateTimeParts = DateTime.toParts(dateTimeHour);
            const isDateTimeBoundary = index === 0;

            const row: RowData = Array.match(hourSchedules, {
              onEmpty: () => ({
                type: "break",
                key: dateHour,
                dateHour,
                dateTimeParts,
                isDateTimeBoundary,
              }),
              onNonEmpty: (schedules) => ({
                type: "schedule",
                key: dateHour,
                schedules,
                previousSchedules: acc.lastNonEmpty,
                dateTimeParts,
                isDateTimeBoundary,
              }),
            });

            return {
              lastNonEmpty: Array.isNonEmptyArray(hourSchedules) ? hourSchedules : acc.lastNonEmpty,
              rows: [...acc.rows, row],
            };
          },
        ),
        (result) => result.rows,
      ),
    [date, schedulesByDateTime],
  );

  return (
    <div className={`border-b border-[#33ccbb]/30 ${isActive ? "bg-[#0f1615]" : "bg-[#0a0f0e]"}`}>
      {/* Schedule Rows - Each row shows one schedule hour with both perspectives */}
      <div>
        {rows.map((row) =>
          row.type === "break" ? (
            <BreakRow
              key={row.key}
              dateHour={row.dateHour}
              dateTimeParts={row.dateTimeParts}
              isDateTimeBoundary={row.isDateTimeBoundary}
            />
          ) : (
            <ScheduleHourRow
              key={row.key}
              schedules={row.schedules}
              previousSchedules={row.previousSchedules}
              dateTimeParts={row.dateTimeParts}
              isDateTimeBoundary={row.isDateTimeBoundary}
            />
          ),
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
