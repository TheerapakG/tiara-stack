import { type MethodOptions, type sheets_v4 } from "@googleapis/sheets";
import { Array, Effect, HashMap, Option, pipe } from "effect";
import { observeEffectSignalOnce } from "typhoon-server/signal";
import { GoogleSheets } from "../google/sheets";
import { GuildConfigService } from "./guildConfigService";
import { SheetConfigService } from "./sheetConfigService";

const parseValueRange = <A = never, E = never, R = never>(
  valueRange: sheets_v4.Schema$ValueRange,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowParser: (row: readonly any[], index: number) => Effect.Effect<A, E, R>,
): Effect.Effect<A[], E, R> =>
  pipe(
    Option.fromNullable(valueRange.values),
    Option.map(Effect.forEach(rowParser)),
    Option.getOrElse(() => Effect.succeed([])),
  );

const zipRows =
  <B>(b: B[]) =>
  <A>(a: A[]) =>
    pipe(
      a,
      Array.zip(b),
      Array.map(([a, b]) => ({ ...a, ...b })),
    );

export type Player = {
  id: Option.Option<string>;
  name: Option.Option<string>;
};

const playerParser = (
  valueRange: sheets_v4.Schema$ValueRange[] | undefined,
): Effect.Effect<Player[], never, never> =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => {
      const [userIds, userSheetNames] = valueRange ?? [];
      return {
        userIds: parseValueRange(userIds, ([userId]) =>
          Effect.succeed({
            id: pipe(Option.fromNullable(userId), Option.map(String)),
          }),
        ),
        userSheetNames: parseValueRange(userSheetNames, ([userSheetName]) =>
          Effect.succeed({
            name: pipe(Option.fromNullable(userSheetName), Option.map(String)),
          }),
        ),
      };
    }),
    Effect.map(({ userIds, userSheetNames }) =>
      pipe(userIds, zipRows(userSheetNames)),
    ),
    Effect.withSpan("playerParser", { captureStackTrace: true }),
  );

export type Schedule = {
  hour: number;
  breakHour: boolean;
  players: readonly [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ];
  empty: number;
};
export type ScheduleMap = HashMap.HashMap<number, Schedule>;

const scheduleParser = (
  valueRange: sheets_v4.Schema$ValueRange[] | undefined,
): Effect.Effect<ScheduleMap, never, never> =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => {
      const [hours, breaks, schedules] = valueRange ?? [];
      return {
        hours: parseValueRange(hours, ([hour]) =>
          Effect.succeed({
            hour: parseInt(hour, 10),
          }),
        ),
        breaks: parseValueRange(breaks, ([breakHour]) =>
          Effect.succeed({
            breakHour: breakHour === "TRUE",
          }),
        ),
        schedules: parseValueRange(schedules, ([p1, p2, p3, p4, p5]) =>
          Effect.succeed({
            players: [
              p1 !== undefined ? String(p1) : undefined,
              p2 !== undefined ? String(p2) : undefined,
              p3 !== undefined ? String(p3) : undefined,
              p4 !== undefined ? String(p4) : undefined,
              p5 !== undefined ? String(p5) : undefined,
            ] as const,
          }),
        ),
      };
    }),
    Effect.map(({ hours, breaks, schedules }) =>
      pipe(
        hours,
        zipRows(breaks),
        zipRows(schedules),
        Array.map(({ hour, breakHour, players }) => ({
          hour,
          breakHour,
          players,
          empty: 5 - players.filter(Boolean).length,
        })),
        Array.filter(({ hour }) => !isNaN(hour)),
        Array.map(
          ({ hour, breakHour, players, empty }) =>
            [hour, { hour, breakHour, players, empty }] as const,
        ),
        HashMap.fromIterable,
      ),
    ),
    Effect.withSpan("scheduleParser", { captureStackTrace: true }),
  );

export class SheetService extends Effect.Service<SheetService>()(
  "SheetService",
  {
    effect: (sheetId: string) =>
      pipe(
        Effect.Do,
        Effect.bind("sheet", () => GoogleSheets),
        Effect.bind("sheetConfigService", () => SheetConfigService),
        Effect.bindAll(({ sheetConfigService }) => ({
          rangesConfig: Effect.cached(
            pipe(
              sheetConfigService.getRangesConfig(sheetId),
              Effect.withSpan("SheetService.rangesConfig", {
                captureStackTrace: true,
              }),
            ),
          ),
          eventConfig: Effect.cached(
            pipe(
              sheetConfigService.getEventConfig(sheetId),
              Effect.withSpan("SheetService.eventConfig", {
                captureStackTrace: true,
              }),
            ),
          ),
        })),
        Effect.let(
          "sheetGet",
          ({ sheet }) =>
            (
              params?: Omit<
                sheets_v4.Params$Resource$Spreadsheets$Values$Batchget,
                "spreadsheetId"
              >,
              options?: MethodOptions,
            ) =>
              pipe(
                sheet.get({ spreadsheetId: sheetId, ...params }, options),
                Effect.withSpan("SheetService.get", {
                  captureStackTrace: true,
                }),
              ),
        ),
        Effect.let(
          "sheetUpdate",
          ({ sheet }) =>
            (
              params?: Omit<
                sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate,
                "spreadsheetId"
              >,
              options?: MethodOptions,
            ) =>
              pipe(
                sheet.update({ spreadsheetId: sheetId, ...params }, options),
                Effect.withSpan("SheetService.update", {
                  captureStackTrace: true,
                }),
              ),
        ),
        Effect.map(({ sheetGet, sheetUpdate, rangesConfig, eventConfig }) => ({
          get: sheetGet,
          update: sheetUpdate,
          getRangesConfig: () =>
            pipe(rangesConfig, Effect.withSpan("SheetService.getRangesConfig")),
          getEventConfig: () =>
            pipe(eventConfig, Effect.withSpan("SheetService.getEventConfig")),
          getPlayers: () =>
            pipe(
              Effect.Do,
              Effect.bind("rangesConfig", () => rangesConfig),
              Effect.bind("sheet", ({ rangesConfig }) =>
                sheetGet({
                  ranges: [rangesConfig.userIds, rangesConfig.userSheetNames],
                }),
              ),
              Effect.flatMap(({ sheet }) =>
                playerParser(sheet.data.valueRanges),
              ),
              Effect.withSpan("SheetService.getPlayers", {
                captureStackTrace: true,
              }),
            ),
          getAllSchedules: () =>
            pipe(
              Effect.Do,
              Effect.bindAll(
                () => ({
                  eventConfig,
                  rangesConfig,
                }),
                { concurrency: "unbounded" },
              ),
              Effect.bind("sheet", ({ rangesConfig }) =>
                sheetGet({
                  ranges: [
                    rangesConfig.hours,
                    rangesConfig.breaks,
                    rangesConfig.hourPlayers,
                  ],
                }),
              ),
              Effect.bind("schedules", ({ sheet }) =>
                scheduleParser(sheet.data.valueRanges),
              ),
              Effect.map(({ eventConfig, schedules }) => ({
                start: eventConfig.startTime,
                schedules,
              })),
              Effect.withSpan("SheetService.getAllSchedules", {
                captureStackTrace: true,
              }),
            ),
          getDaySchedules: (day: number) =>
            pipe(
              Effect.Do,
              Effect.bindAll(
                () => ({
                  eventConfig,
                  rangesConfig,
                }),
                { concurrency: "unbounded" },
              ),
              Effect.bind("sheet", () =>
                sheetGet({
                  ranges: [
                    `'Day ${day}'!J3:J`,
                    `'Day ${day}'!C3:C`,
                    `'Day ${day}'!K3:O`,
                  ],
                }),
              ),
              Effect.bind("schedules", ({ sheet }) =>
                scheduleParser(sheet.data.valueRanges),
              ),
              Effect.map(({ eventConfig, schedules }) => ({
                start: eventConfig.startTime,
                schedules,
              })),
              Effect.withSpan("SheetService.getDaySchedules", {
                captureStackTrace: true,
              }),
            ),
        })),
      ),
    dependencies: [GoogleSheets.Default, SheetConfigService.Default],
    accessors: true,
  },
) {
  static ofGuild(guildId: string) {
    return pipe(
      Effect.Do,
      Effect.bind("guildConfig", () =>
        observeEffectSignalOnce(GuildConfigService.getConfig(guildId)),
      ),
      Effect.bind("sheetId", ({ guildConfig }) =>
        pipe(
          guildConfig,
          Array.head,
          Option.map((guildConfig) => guildConfig.sheetId),
          Option.flatMap(Option.fromNullable),
        ),
      ),
      Effect.map(({ sheetId }) =>
        SheetService.DefaultWithoutDependencies(sheetId),
      ),
      Effect.withSpan("SheetService.ofGuild", { captureStackTrace: true }),
    );
  }
}
