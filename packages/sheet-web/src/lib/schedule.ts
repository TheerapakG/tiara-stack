import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useAtomSuspense } from "@effect/atom-react";
import { Sheet, Google, SheetConfig } from "sheet-apis/schema";
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
  Result,
  Schema,
} from "effect";
import {
  catchSchemaErrorAsValidationError,
  QueryResultAppError,
  QueryResultParseError,
  ValidationError,
} from "typhoon-core/error";
import { RequestError } from "#/lib/error";
import { useMemo } from "react";
import { zoneId } from "#/hooks/useDateTimeZoned";

// Re-export types from sheet-apis
export type ScheduleResult = Sheet.PopulatedScheduleResult;
export type SchedulePlayer = Sheet.PopulatedSchedulePlayer;
export type GuildScheduleResponse = Sheet.PopulatedScheduleResponse;
export type ScheduleView = Sheet.ScheduleView;

const GuildScheduleErrorSchema = Schema.revealCodec(
  Schema.Union([
    ValidationError,
    QueryResultAppError,
    QueryResultParseError,
    Google.GoogleSheetsError,
    Sheet.ParserFieldError,
    SheetConfig.SheetConfigError,
    RequestError,
  ]),
);

const GuildScheduleResponseAsyncResultSchema = Schema.revealCodec(
  AsyncResult.Schema({
    success: Sheet.PopulatedScheduleResponse,
    error: GuildScheduleErrorSchema,
  }),
);

const GuildSchedulesAsyncResultSchema = Schema.revealCodec(
  AsyncResult.Schema({
    success: Schema.Array(Sheet.PopulatedScheduleResult),
    error: GuildScheduleErrorSchema,
  }),
);

const GuildScheduleViewAsyncResultSchema = Schema.revealCodec(
  AsyncResult.Schema({
    success: Sheet.ScheduleView,
    error: GuildScheduleErrorSchema,
  }),
);

const GuildChannelsAsyncResultSchema = Schema.revealCodec(
  AsyncResult.Schema({
    success: Schema.Array(Schema.String),
    error: GuildScheduleErrorSchema,
  }),
);

const ScheduledDaysAsyncResultSchema = Schema.revealCodec(
  AsyncResult.Schema({
    success: Schema.HashSet(Schema.String),
    error: GuildScheduleErrorSchema,
  }),
);

// Private atom for fetching all schedules for a guild
const _guildScheduleResponseAtom = Atom.family((guildId: string) =>
  SheetApisClient.query("schedule", "getAllPopulatedSchedules", {
    query: { guildId },
  }),
);

// Serializable atom for guild schedule response
export const guildScheduleResponseAtom = Atom.family((guildId: string) =>
  Atom.make(
    Effect.fnUntraced(function* (get) {
      return yield* get.result(_guildScheduleResponseAtom(guildId)).pipe(
        catchSchemaErrorAsValidationError,
        Effect.catchTags({
          BadRequest: () => Effect.fail(RequestError.makeUnsafe({})),
        }),
      );
    }),
  ).pipe(
    Atom.setIdleTTL(Duration.infinity),
    Atom.serializable({
      key: `schedule.response.getAllPopulatedSchedules.${guildId}`,
      schema: GuildScheduleResponseAsyncResultSchema,
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
      schema: GuildSchedulesAsyncResultSchema,
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
      schema: GuildScheduleViewAsyncResultSchema,
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
      const uniqueChannels = Array.fromIterable(channelSet);
      return [...uniqueChannels].sort() as readonly string[];
    }),
  ).pipe(
    Atom.setIdleTTL(Duration.infinity),
    Atom.serializable({
      key: `schedule.derived.getAllChannels.${guildId}`,
      schema: GuildChannelsAsyncResultSchema,
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
          Result.fromOption(() => undefined),
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
      schema: ScheduledDaysAsyncResultSchema,
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
  if (DateTime.isLessThan(dateTime, startTime)) return Option.none();

  const hours = Math.floor(Duration.toHours(DateTime.distance(startTime, dateTime))) + 1;
  if (hours > maxHour) return Option.none();

  return Option.some(hours);
};
