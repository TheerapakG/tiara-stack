import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DateTime, Option, Effect, pipe, HashMap, Array, Duration } from "effect";

import { ensureResultAtomData } from "#/lib/atomRegistry";
import {
  type SchedulePlayer,
  guildScheduleAtom,
  useGuildSchedule,
  computeScheduleDateTime,
  computeScheduleHour,
  formatDayKey,
} from "#/lib/schedule";
import { Sheet } from "sheet-apis/schema";
import { eventConfigAtom, useEventConfig } from "#/lib/sheet";
import { useTimeZone } from "#/hooks/useTimeZone";
import { useCurrentDateTime, useZonedOrNow } from "#/hooks/useDateTimeZoned";
import { currentUserAtom, useCurrentUser } from "#/lib/discord";
import { cn } from "#/lib/utils";
import {
  buildSharedDayLayoutId,
  calendarRestTransition,
  morphLayoutTransition,
  useScheduleSelected,
} from "./-transition";

// Virtualizer constants
const ESTIMATE_SIZE = 23 + 24 * 44;
const INITIAL_START_OFFSET = -10;
const INITIAL_END_OFFSET = 10;

export const Route = createFileRoute(
  "/_authenticated/dashboard/guilds/$guildId/schedule/$channel/_channelLayout/daily",
)({
  component: DailyPage,
  ssr: "data-only",
  loader: async ({ context, params }) => {
    await Effect.runPromise(
      Effect.all(
        [
          ensureResultAtomData(context.atomRegistry, guildScheduleAtom(params.guildId)),
          ensureResultAtomData(context.atomRegistry, eventConfigAtom(params.guildId)),
          ensureResultAtomData(context.atomRegistry, currentUserAtom),
        ],
        { concurrency: "unbounded" },
      ),
    );
  },
});

function DailyPage() {
  const timeZone = useTimeZone();
  const search = Route.useSearch();
  const selected = useScheduleSelected(search);
  const currentDate = useZonedOrNow(timeZone, search.timestamp);
  const sourceMonth = useMemo(
    () =>
      selected && DateTime.Equivalence(selected.day, DateTime.startOf(currentDate, "day"))
        ? selected.month
        : DateTime.startOf(currentDate, "month"),
    [selected, currentDate],
  );
  const sharedLayoutId = buildSharedDayLayoutId(currentDate, sourceMonth);

  return (
    <motion.div
      layoutId={sharedLayoutId}
      transition={{
        layout: morphLayoutTransition,
      }}
      className="border border-[#33ccbb]/20 bg-[#0a0f0e]"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={calendarRestTransition}
      >
        <DailyHeader sourceMonth={sourceMonth} currentDate={currentDate} />
        <DailyScheduleContent />
      </motion.div>
    </motion.div>
  );
}

// Header component
function DailyHeader({
  sourceMonth,
  currentDate,
}: {
  sourceMonth: DateTime.Zoned;
  currentDate: DateTime.Zoned;
}) {
  const { channel, guildId } = Route.useParams();

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#33ccbb]/20 bg-[#0f1615]">
      <Link
        className="flex items-center gap-2 text-[#33ccbb] hover:text-white transition-colors"
        to="/dashboard/guilds/$guildId/schedule/$channel/calendar"
        params={{ guildId, channel }}
        search={{
          timestamp: DateTime.toEpochMillis(sourceMonth),
          from: { view: "daily", timestamp: DateTime.toEpochMillis(currentDate) },
        }}
        mask={{
          to: "/dashboard/guilds/$guildId/schedule/$channel/calendar",
          params: { guildId, channel },
          search: { timestamp: DateTime.toEpochMillis(sourceMonth) },
          unmaskOnReload: true,
        }}
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm font-bold tracking-wide">BACK TO CALENDAR</span>
      </Link>
    </div>
  );
}

// Main content - loads data and renders infinite scroll
function DailyScheduleContent() {
  const { channel, guildId } = Route.useParams();
  const timeZone = useTimeZone();
  const search = Route.useSearch();
  const parentRef = useRef<HTMLDivElement>(null);
  const currentDateTime = useCurrentDateTime();

  const currentDate = useZonedOrNow(timeZone, search.timestamp);
  const liveNow = useMemo(
    () => DateTime.setZone(currentDateTime, timeZone),
    [currentDateTime, timeZone],
  );
  const currentHourKey = useMemo(() => DateTime.startOf(liveNow, "hour"), [liveNow]);

  // Load schedules and eventConfig
  const allSchedules = useGuildSchedule(guildId);
  const eventConfig = useEventConfig(guildId);
  const startTimeZoned = useZonedOrNow(timeZone, DateTime.toEpochMillis(eventConfig.startTime));

  const channelSchedules = useMemo(
    () => allSchedules.filter((s) => s.channel === channel && Option.isSome(s.hour)),
    [allSchedules, channel],
  );

  const dayByScheduleHour = useMemo(() => {
    return pipe(
      channelSchedules,
      Array.reduce(HashMap.empty<number, number>(), (acc, schedule) => {
        const hour = (schedule.hour as Option.Some<number>).value;
        return HashMap.set(acc, hour, schedule.day);
      }),
    );
  }, [channelSchedules]);

  const maxScheduleHour = useMemo(() => {
    const hours = channelSchedules.map((s) => (s.hour as Option.Some<number>).value);
    return hours.length > 0 ? Math.max(...hours) : 0;
  }, [channelSchedules]);

  const populatedChannelSchedules = useMemo(
    () =>
      channelSchedules.filter(
        (s): s is Sheet.PopulatedSchedule => s._tag === "PopulatedSchedule" && s.visible,
      ),
    [channelSchedules],
  );

  // Group schedules by date -> DateTime -> PopulatedSchedule[]
  const schedulesByDate = useMemo(() => {
    return pipe(
      populatedChannelSchedules,
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
  }, [populatedChannelSchedules, startTimeZoned]);

  const currentDateKey = useMemo(() => DateTime.startOf(currentDate, "day"), [currentDate]);

  // Get current user for highlighting
  const currentUser = useCurrentUser();
  const currentUserId = currentUser?.id;

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
                startTimeZoned={startTimeZoned}
                maxHour={maxScheduleHour}
                dayByScheduleHour={dayByScheduleHour}
                currentUserId={currentUserId}
                currentHourKey={currentHourKey}
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
  scheduleHour: Option.Option<number>;
  scheduleDay: Option.Option<number>;
  isScheduleDayBoundary: boolean;
  dateTimeParts: DateTime.DateTime.Parts;
  isDateTimeBoundary: boolean;
  isCurrentHour: boolean;
}

function BreakRow({
  scheduleHour,
  scheduleDay,
  isScheduleDayBoundary,
  dateTimeParts,
  isDateTimeBoundary,
  isCurrentHour,
}: BreakRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[140px_1fr] border-b border-[#33ccbb]/10 last:border-b-0",
        isCurrentHour ? "bg-[#33ccbb]" : "opacity-40",
      )}
    >
      {/* Left Side - Hour */}
      <div
        className={cn(
          "border-r p-3 h-[44px] flex flex-col items-end justify-center",
          isCurrentHour
            ? "border-[#041311]/15 bg-[#2fc0b2]"
            : "border-[#33ccbb]/10 bg-[#0f1615]/50",
          isDateTimeBoundary &&
            (isCurrentHour
              ? "border-t-2 border-t-[#041311]/15"
              : "border-t-2 border-t-[#33ccbb]/40"),
        )}
      >
        {Option.isSome(scheduleDay) && isScheduleDayBoundary && (
          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-wider leading-none",
              isCurrentHour ? "text-[#041311]/65" : "text-[#33ccbb]/60",
            )}
          >
            Day {scheduleDay.value}
          </span>
        )}
        {Option.isSome(scheduleHour) && (
          <span
            className={cn(
              "text-sm font-bold tabular-nums leading-none",
              isCurrentHour ? "text-[#041311]" : "text-[#33ccbb]/80",
            )}
          >
            {scheduleHour.value}
          </span>
        )}
      </div>

      {/* Right Side - Date + Break */}
      <div
        className={cn(
          "p-3 h-[44px] flex items-center gap-4",
          isDateTimeBoundary &&
            (isCurrentHour
              ? "border-t-2 border-t-[#041311]/15"
              : "border-t-2 border-t-[#33ccbb]/40"),
        )}
      >
        {/* Actual Date Marker */}
        <div className="w-20 shrink-0">
          {isDateTimeBoundary ? (
            <div className="flex flex-col leading-tight">
              <span
                className={cn(
                  "text-xs font-black tabular-nums",
                  isCurrentHour ? "text-[#041311]" : "text-white",
                )}
              >
                {dateTimeParts.day}
              </span>
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-wider",
                  isCurrentHour ? "text-[#041311]/70" : "text-[#33ccbb]",
                )}
              >
                {dateTimeParts.month}/{dateTimeParts.year}
              </span>
            </div>
          ) : (
            <span
              className={cn(
                "text-xs font-bold tabular-nums",
                isCurrentHour ? "text-[#041311]/80" : "text-white/40",
              )}
            >
              {String(dateTimeParts.hours).padStart(2, "0")}:00
            </span>
          )}
        </div>

        {/* Break Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                isCurrentHour ? "bg-[#041311]/35" : "bg-[#33ccbb]/30",
              )}
            />
            <span
              className={cn(
                "text-sm font-medium italic",
                isCurrentHour ? "text-[#041311]/80" : "text-white/40",
              )}
            >
              Break
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Schedule Row Component - Full row for schedule hours
interface ScheduleHourRowProps {
  schedules: Array.NonEmptyReadonlyArray<Sheet.PopulatedSchedule>;
  scheduleHour: Option.Option<number>;
  scheduleDay: Option.Option<number>;
  isScheduleDayBoundary: boolean;
  dateTimeParts: DateTime.DateTime.Parts;
  isDateTimeBoundary: boolean;
  currentUserId: string | undefined;
  isCurrentHour: boolean;
}

function ScheduleHourRow({
  schedules,
  scheduleHour,
  scheduleDay,
  isScheduleDayBoundary,
  dateTimeParts,
  isDateTimeBoundary,
  currentUserId,
  isCurrentHour,
}: ScheduleHourRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[140px_1fr] border-b border-[#33ccbb]/10 last:border-b-0",
        isCurrentHour && "bg-[#33ccbb]",
      )}
    >
      {/* Left Side - Schedule Day + Hour */}
      <div
        className={cn(
          "border-r p-3 h-[44px] flex flex-col items-end justify-center",
          isCurrentHour
            ? "border-[#041311]/15 bg-[#2fc0b2]"
            : "border-[#33ccbb]/10 bg-[#0f1615]/50",
          isDateTimeBoundary &&
            (isCurrentHour
              ? "border-t-2 border-t-[#041311]/15"
              : "border-t-2 border-t-[#33ccbb]/40"),
        )}
      >
        {Option.isSome(scheduleDay) && isScheduleDayBoundary && (
          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-wider leading-none",
              isCurrentHour ? "text-[#041311]/65" : "text-[#33ccbb]/60",
            )}
          >
            Day {scheduleDay.value}
          </span>
        )}
        {Option.isSome(scheduleHour) && (
          <span
            className={cn(
              "text-sm font-bold tabular-nums leading-none",
              isCurrentHour ? "text-[#041311]" : "text-[#33ccbb]/80",
            )}
          >
            {scheduleHour.value}
          </span>
        )}
      </div>

      {/* Right Side - Actual Date + Hour */}
      <div
        className={cn(
          "p-3 h-[44px] flex items-center gap-4",
          isDateTimeBoundary &&
            (isCurrentHour
              ? "border-t-2 border-t-[#041311]/15"
              : "border-t-2 border-t-[#33ccbb]/40"),
        )}
      >
        {/* Actual Date Marker */}
        <div className="w-20 shrink-0">
          {isDateTimeBoundary ? (
            <div className="flex flex-col leading-tight">
              <span
                className={cn(
                  "text-xs font-black tabular-nums",
                  isCurrentHour ? "text-[#041311]" : "text-white",
                )}
              >
                {dateTimeParts.day}
              </span>
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-wider",
                  isCurrentHour ? "text-[#041311]/70" : "text-[#33ccbb]",
                )}
              >
                {dateTimeParts.month}/{dateTimeParts.year}
              </span>
            </div>
          ) : (
            <span
              className={cn(
                "text-xs font-bold tabular-nums",
                isCurrentHour ? "text-[#041311]/80" : "text-white/40",
              )}
            >
              {String(dateTimeParts.hours).padStart(2, "0")}:00
            </span>
          )}
        </div>

        {/* Schedule Content */}
        <div className="flex-1 space-y-2">
          {schedules.map((schedule, idx) => (
            <ScheduleRow
              key={idx}
              schedule={schedule}
              currentUserId={currentUserId}
              isCurrentHour={isCurrentHour}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Individual Day Block - Shows unified timeline with both schedule and actual date perspectives
type RowData =
  | {
      type: "break";
      key: number;
      scheduleHour: Option.Option<number>;
      scheduleDay: Option.Option<number>;
      isScheduleDayBoundary: boolean;
      dateTimeParts: DateTime.DateTime.Parts;
      isDateTimeBoundary: boolean;
      isCurrentHour: boolean;
    }
  | {
      type: "schedule";
      key: number;
      schedules: Array.NonEmptyReadonlyArray<Sheet.PopulatedSchedule>;
      scheduleHour: Option.Option<number>;
      scheduleDay: Option.Option<number>;
      isScheduleDayBoundary: boolean;
      dateTimeParts: DateTime.DateTime.Parts;
      isDateTimeBoundary: boolean;
      isCurrentHour: boolean;
    };

interface DateBlockProps {
  date: DateTime.Zoned;
  schedulesByDateTime: HashMap.HashMap<DateTime.Zoned, Sheet.PopulatedSchedule[]>;
  isActive: boolean;
  startTimeZoned: DateTime.Zoned;
  maxHour: number;
  dayByScheduleHour: HashMap.HashMap<number, number>;
  currentUserId: string | undefined;
  currentHourKey: DateTime.Zoned;
}

function DateBlock({
  date,
  schedulesByDateTime,
  isActive,
  startTimeZoned,
  maxHour,
  dayByScheduleHour,
  currentUserId,
  currentHourKey,
}: DateBlockProps) {
  // Build rows using dayByScheduleHour lookup for schedule day
  const rows = useMemo(
    () =>
      pipe(
        Array.range(0, 23),
        Array.map((dateHour, index) => {
          const dateTimeHour = DateTime.addDuration(date, Duration.hours(dateHour));
          const hourSchedules = Option.getOrElse(
            HashMap.get(schedulesByDateTime, dateTimeHour),
            () => [],
          );
          const dateTimeParts = DateTime.toParts(dateTimeHour);
          const isDateTimeBoundary = index === 0;
          const isCurrentHour = DateTime.Equivalence(dateTimeHour, currentHourKey);

          // Compute schedule hour from datetime using computeScheduleHour
          const scheduleHour = computeScheduleHour(startTimeZoned, dateTimeHour, maxHour);

          // Look up schedule day from dayByScheduleHour using scheduleHour
          const scheduleDay = Option.flatMap(scheduleHour, (hour) =>
            HashMap.get(dayByScheduleHour, hour),
          );

          // Determine if this is a schedule day boundary
          // It's a boundary if this hour has a schedule day and the previous hour has a different day or no day
          const isScheduleDayBoundary =
            Option.isSome(scheduleDay) &&
            Option.isSome(scheduleHour) &&
            pipe(
              HashMap.get(dayByScheduleHour, scheduleHour.value - 1),
              Option.map((prevDay) => prevDay !== scheduleDay.value),
              Option.getOrElse(() => true),
            );

          return Array.match(hourSchedules, {
            onEmpty: (): RowData => ({
              type: "break",
              key: dateHour,
              scheduleHour,
              scheduleDay,
              isScheduleDayBoundary,
              dateTimeParts,
              isDateTimeBoundary,
              isCurrentHour,
            }),
            onNonEmpty: (schedules): RowData => ({
              type: "schedule",
              key: dateHour,
              schedules,
              scheduleHour,
              scheduleDay,
              isScheduleDayBoundary,
              dateTimeParts,
              isDateTimeBoundary,
              isCurrentHour,
            }),
          });
        }),
      ),
    [date, schedulesByDateTime, startTimeZoned, maxHour, dayByScheduleHour, currentHourKey],
  );

  return (
    <div className={`border-b border-[#33ccbb]/30 ${isActive ? "bg-[#0f1615]" : "bg-[#0a0f0e]"}`}>
      {/* Schedule Rows - Each row shows one schedule hour with both perspectives */}
      <div>
        {rows.map((row) =>
          row.type === "break" ? (
            <BreakRow
              key={row.key}
              scheduleHour={row.scheduleHour}
              scheduleDay={row.scheduleDay}
              isScheduleDayBoundary={row.isScheduleDayBoundary}
              dateTimeParts={row.dateTimeParts}
              isDateTimeBoundary={row.isDateTimeBoundary}
              isCurrentHour={row.isCurrentHour}
            />
          ) : (
            <ScheduleHourRow
              key={row.key}
              schedules={row.schedules}
              scheduleHour={row.scheduleHour}
              scheduleDay={row.scheduleDay}
              isScheduleDayBoundary={row.isScheduleDayBoundary}
              dateTimeParts={row.dateTimeParts}
              isDateTimeBoundary={row.isDateTimeBoundary}
              currentUserId={currentUserId}
              isCurrentHour={row.isCurrentHour}
            />
          ),
        )}
      </div>
    </div>
  );
}

// Schedule Row Component - Shows only Fillers (callers must filter out break schedules)
function ScheduleRow({
  schedule,
  currentUserId,
  isCurrentHour,
}: {
  schedule: Sheet.PopulatedSchedule;
  currentUserId: string | undefined;
  isCurrentHour: boolean;
}) {
  const fills = schedule.fills.filter(Option.isSome).map((f: { value: SchedulePlayer }) => f.value);

  if (fills.length === 0) {
    return <div className="h-full" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {fills.map((fill: SchedulePlayer, idx: number) => (
        <PlayerBadge
          key={idx}
          player={fill}
          currentUserId={currentUserId}
          isCurrentHour={isCurrentHour}
        />
      ))}
    </div>
  );
}

// Player Badge Component
function PlayerBadge({
  player,
  currentUserId,
  isCurrentHour,
}: {
  player: SchedulePlayer;
  currentUserId: string | undefined;
  isCurrentHour: boolean;
}) {
  const isCurrentUser =
    currentUserId !== undefined &&
    player.player._tag === "Player" &&
    player.player.id === currentUserId;

  return (
    <span
      className={`text-xs ${
        isCurrentHour
          ? isCurrentUser
            ? player.enc
              ? "font-black text-[#041311]"
              : "text-[#07211d] underline decoration-[#07211d]/45 underline-offset-2"
            : player.enc
              ? "font-bold text-[#041311]"
              : "text-[#041311]/80"
          : isCurrentUser
            ? player.enc
              ? "font-bold text-[#33ccbb]"
              : "text-[#33ccbb]"
            : player.enc
              ? "font-bold text-white"
              : "text-white/80"
      }`}
    >
      {player.player.name}
      {player.enc && (
        <span
          className={`ml-1 text-[10px] ${
            isCurrentHour
              ? isCurrentUser
                ? "text-[#07211d]/65"
                : "text-[#041311]/60"
              : isCurrentUser
                ? "text-[#33ccbb]/70"
                : "text-white/50"
          }`}
        >
          (encore)
        </span>
      )}
    </span>
  );
}
