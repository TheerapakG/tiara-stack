import { Atom, Result, useAtomSuspense } from "@effect-atom/atom-react";
import { Sheet, Google, SheetConfig, Middlewares } from "sheet-apis/schema";
import { SheetApisClient } from "#/lib/sheetApis";
import {
  Array,
  DateTime,
  Duration,
  Effect,
  HashSet,
  Option,
  pipe,
  Predicate,
  Schema,
} from "effect";
import {
  catchParseErrorAsValidationError,
  QueryResultError,
  ValidationError,
} from "typhoon-core/error";
import { RequestError, ResponseError } from "#/lib/error";
import { useMemo } from "react";
import { zoneId } from "#/hooks/useDateTimeZoned";

// Re-export types from sheet-apis
export type ScheduleResult = Sheet.PopulatedScheduleResult;
export type SchedulePlayer = Sheet.PopulatedSchedulePlayer;
export type GuildScheduleResponse = Sheet.PopulatedScheduleResponse;
export type ScheduleView = Sheet.ScheduleView;

const GuildScheduleError = Schema.Union(
  ValidationError,
  QueryResultError,
  Google.GoogleSheetsError,
  Sheet.ParserFieldError,
  SheetConfig.SheetConfigError,
  Middlewares.Unauthorized,
  RequestError,
  ResponseError,
);

// Private atom for fetching all schedules for a guild
const _guildScheduleResponseAtom = Atom.family((guildId: string) =>
  SheetApisClient.query("schedule", "getAllPopulatedSchedules", {
    urlParams: { guildId },
  }),
);

// Serializable atom for guild schedule response
export const guildScheduleResponseAtom = Atom.family((guildId: string) =>
  Atom.make(
    Effect.fnUntraced(function* (get) {
      return yield* get.result(_guildScheduleResponseAtom(guildId)).pipe(
        catchParseErrorAsValidationError,
        Effect.catchTags({
          RequestError: (error) => Effect.fail(RequestError.make(error)),
          ResponseError: (error) => Effect.fail(ResponseError.make(error)),
        }),
      );
    }),
  ).pipe(
    Atom.setIdleTTL(Duration.infinity),
    Atom.serializable({
      key: `schedule.response.getAllPopulatedSchedules.${guildId}`,
      schema: Result.Schema({
        success: Sheet.PopulatedScheduleResponse,
        error: GuildScheduleError,
      }),
    }),
  ),
);

// Serializable atom for guild schedules only
export const guildScheduleAtom = Atom.family((guildId: string) =>
  Atom.make(
    Effect.fnUntraced(function* (get) {
      const response = yield* get.result(guildScheduleResponseAtom(guildId));
      return response.schedules;
    }),
  ).pipe(
    Atom.setIdleTTL(Duration.infinity),
    Atom.serializable({
      key: `schedule.getAllPopulatedSchedules.${guildId}`,
      schema: Result.Schema({
        success: Schema.Array(Sheet.PopulatedScheduleResult),
        error: GuildScheduleError,
      }),
    }),
  ),
);

export const guildScheduleViewAtom = Atom.family((guildId: string) =>
  Atom.make(
    Effect.fnUntraced(function* (get) {
      const response = yield* get.result(guildScheduleResponseAtom(guildId));
      return response.view;
    }),
  ).pipe(
    Atom.setIdleTTL(Duration.infinity),
    Atom.serializable({
      key: `schedule.getAllPopulatedSchedules.view.${guildId}`,
      schema: Result.Schema({
        success: Sheet.ScheduleView,
        error: GuildScheduleError,
      }),
    }),
  ),
);

// Hook to use month schedule data
export const useGuildSchedule = (guildId: string) => {
  const atom = useMemo(() => guildScheduleAtom(guildId), [guildId]);
  const result = useAtomSuspense(atom, {
    suspendOnWaiting: false,
    includeFailure: false,
  });
  return result.value;
};

export const useGuildScheduleView = (guildId: string) => {
  const atom = useMemo(() => guildScheduleViewAtom(guildId), [guildId]);
  const result = useAtomSuspense(atom, {
    suspendOnWaiting: false,
    includeFailure: false,
  });
  return result.value;
};

export const getAllChannelsAtom = Atom.family((guildId: string) =>
  Atom.make(
    Effect.fnUntraced(function* (get) {
      const schedules = yield* get.result(guildScheduleAtom(guildId));
      const populatedSchedules = schedules.filter(
        (s): s is Sheet.PopulatedSchedule => s._tag === "PopulatedSchedule",
      );
      const channelArray = populatedSchedules.map((s) => s.channel);
      const channelSet = HashSet.fromIterable(channelArray);
      const uniqueChannels = Array.fromIterable(HashSet.toValues(channelSet));
      return [...uniqueChannels].sort() as readonly string[];
    }),
  ).pipe(
    Atom.setIdleTTL(Duration.infinity),
    Atom.serializable({
      key: `schedule.derived.getAllChannels.${guildId}`,
      schema: Result.Schema({
        success: Schema.Array(Schema.String),
        error: GuildScheduleError,
      }),
    }),
  ),
);

export const useAllChannels = (guildId: string) => {
  const atom = useMemo(() => getAllChannelsAtom(guildId), [guildId]);
  const result = useAtomSuspense(atom, {
    suspendOnWaiting: false,
    includeFailure: false,
  });
  return result.value;
};

// Parameters for scheduledDaysAtom
export interface ScheduledDaysParams {
  guildId: string;
  channel: string;
  timeZone: DateTime.TimeZone;
  rangeStart: DateTime.Zoned;
  rangeEnd: DateTime.Zoned;
}

export function formatDayKey(dateTime: DateTime.Zoned): string {
  const parts = DateTime.toParts(dateTime);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

const _scheduledDaysAtom = Atom.family((params: ScheduledDaysParams) =>
  Atom.make(
    Effect.fnUntraced(function* (get) {
      const { guildId, channel, timeZone, rangeStart, rangeEnd } = params;
      const schedules = yield* get.result(guildScheduleAtom(guildId));

      const isInChannel = (s: Sheet.PopulatedScheduleResult) =>
        Predicate.isTagged("PopulatedSchedule")(s) && s.channel === channel && s.visible;

      const isInRange = (s: Sheet.PopulatedScheduleResult) => {
        return pipe(
          s.hourWindow,
          Option.exists((hourWindow) =>
            DateTime.between(DateTime.setZone(hourWindow.start, timeZone), {
              minimum: rangeStart,
              maximum: rangeEnd,
            }),
          ),
        );
      };

      const getDayKey = (s: Sheet.PopulatedScheduleResult) => {
        return pipe(
          s.hourWindow,
          Option.map((hourWindow) => formatDayKey(DateTime.setZone(hourWindow.start, timeZone))),
        );
      };

      const scheduledDays = pipe(
        schedules,
        Array.filter(isInChannel),
        Array.filter(isInRange),
        Array.filterMap(getDayKey),
        HashSet.fromIterable,
      );

      return scheduledDays;
    }),
  ),
);

export const scheduledDaysAtom = Atom.family((params: ScheduledDaysParams) =>
  _scheduledDaysAtom(params).pipe(
    Atom.setIdleTTL(Duration.infinity),
    Atom.serializable({
      key: `schedule.derived.scheduledDays.${params.guildId}.${params.channel}.${zoneId(params.timeZone)}.${DateTime.toEpochMillis(params.rangeStart)}-${DateTime.toEpochMillis(params.rangeEnd)}`,
      schema: Result.Schema({
        success: Schema.HashSet(Schema.String),
        error: GuildScheduleError,
      }),
    }),
  ),
);

// Hook to use scheduled days for a calendar view
export const useScheduledDays = (params: ScheduledDaysParams) => {
  const atom = useMemo(
    () => scheduledDaysAtom(params),
    [
      params.guildId,
      params.channel,
      zoneId(params.timeZone),
      DateTime.toEpochMillis(params.rangeStart),
      DateTime.toEpochMillis(params.rangeEnd),
    ],
  );
  const result = useAtomSuspense(atom, {
    suspendOnWaiting: false,
    includeFailure: false,
  });
  return result.value;
};

export const computeScheduleHour = (
  startTime: DateTime.Zoned,
  dateTime: DateTime.Zoned,
  maxHour: number,
): Option.Option<number> => {
  // Return none if dateTime is before startTime
  if (DateTime.lessThan(dateTime, startTime)) return Option.none();

  const hours = Math.floor(Duration.toHours(DateTime.distance(startTime, dateTime))) + 1;
  if (hours > maxHour) return Option.none();

  return Option.some(hours);
};
