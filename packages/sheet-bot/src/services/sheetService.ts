import { type MethodOptions, type sheets_v4 } from "@googleapis/sheets";
import { Array, Data, Effect, HashMap, Option, Order, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import { ArrayWithDefault, collectArrayToHashMap } from "typhoon-server/utils";
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

export class RawPlayer extends Data.TaggedClass("RawPlayer")<{
  id: Option.Option<string>;
  name: Option.Option<string>;
}> {}

const playerParser = (
  valueRange: sheets_v4.Schema$ValueRange[] | undefined,
): Effect.Effect<RawPlayer[], never, never> =>
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
      pipe(
        new ArrayWithDefault({
          array: userIds,
          default: { id: Option.none() },
        }),
        ArrayWithDefault.zip(
          new ArrayWithDefault({
            array: userSheetNames,
            default: { name: Option.none() },
          }),
        ),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.map(({ id, name }) => new RawPlayer({ id, name })),
      ),
    ),
    Effect.withSpan("playerParser", { captureStackTrace: true }),
  );

export class RawTeam extends Data.TaggedClass("RawTeam")<{
  teamName: string;
  lead: Option.Option<number>;
  backline: Option.Option<number>;
  talent: Option.Option<number>;
}> {}

const teamParser = (
  valueRange: sheets_v4.Schema$ValueRange[] | undefined,
): Effect.Effect<
  HashMap.HashMap<string, { id: string; teams: RawTeam[] }>,
  never,
  never
> =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => {
      const [userIds, userTeams] = valueRange ?? [];
      return {
        userIds: parseValueRange(userIds, ([userId]) =>
          Effect.succeed({
            id: pipe(Option.fromNullable(userId), Option.map(String)),
          }),
        ),
        userTeams: parseValueRange(userTeams, (teams) =>
          Effect.succeed({
            teams: pipe(
              teams,
              Array.chunksOf(6),
              Array.map(
                ([teamName, _isv, lead, backline, talent, _isvPercent]) => ({
                  teamName: pipe(
                    Option.fromNullable(teamName),
                    Option.map(String),
                  ),
                  lead: pipe(
                    Option.fromNullable(lead),
                    Option.map((lead) => parseInt(lead, 10)),
                  ),
                  backline: pipe(
                    Option.fromNullable(backline),
                    Option.map((backline) => parseInt(backline, 10)),
                  ),
                  talent: pipe(
                    Option.fromNullable(talent),
                    Option.map((talent) => parseInt(talent, 10)),
                  ),
                }),
              ),
              Array.map(({ teamName, lead, backline, talent }) =>
                pipe(
                  teamName,
                  Option.map(
                    (teamName) =>
                      new RawTeam({ teamName, lead, backline, talent }),
                  ),
                  Option.filter(({ teamName }) => teamName !== ""),
                ),
              ),
              Array.getSomes,
            ),
          }),
        ),
      };
    }),
    Effect.map(({ userIds, userTeams }) =>
      pipe(
        new ArrayWithDefault({
          array: userIds,
          default: { id: Option.none() },
        }),
        ArrayWithDefault.zip(
          new ArrayWithDefault({ array: userTeams, default: { teams: [] } }),
        ),
        ArrayWithDefault.map(({ id, teams }) =>
          pipe(
            id,
            Option.map((id) => ({
              id,
              teams: pipe(
                teams,
                Array.map(
                  ({ teamName, lead, backline, talent }) =>
                    new RawTeam({ teamName, lead, backline, talent }),
                ),
              ),
            })),
          ),
        ),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.getSomes,
        collectArrayToHashMap({
          keyGetter: ({ id }) => id,
          keyValueReducer: (a, b) => ({
            id: a.id,
            teams: Array.appendAll(a.teams, b.teams),
          }),
        }),
      ),
    ),
    Effect.withSpan("playerParser", { captureStackTrace: true }),
  );

export type Schedule = {
  hour: number;
  breakHour: boolean;
  fills: readonly [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ];
  overfills: string[];
  standbys: string[];
  empty: number;
};
export type ScheduleMap = HashMap.HashMap<number, Schedule>;

const scheduleParser = (
  valueRange: sheets_v4.Schema$ValueRange[] | undefined,
): Effect.Effect<ScheduleMap, never, never> =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => {
      const [hours, breaks, fills, overfills, standbys] = valueRange ?? [];
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
        fills: parseValueRange(fills, ([p1, p2, p3, p4, p5]) =>
          Effect.succeed({
            fills: [
              p1 ? String(p1) : undefined,
              p2 ? String(p2) : undefined,
              p3 ? String(p3) : undefined,
              p4 ? String(p4) : undefined,
              p5 ? String(p5) : undefined,
            ] as const,
          }),
        ),
        overfills: parseValueRange(overfills, ([overfill]) =>
          Effect.succeed({
            overfills:
              overfill !== undefined
                ? String(overfill)
                    .split(",")
                    .map((player) => player.trim())
                : [],
          }),
        ),
        standbys: parseValueRange(standbys, ([standby]) =>
          Effect.succeed({
            standbys:
              standby !== undefined
                ? String(standby)
                    .split(",")
                    .map((player) => player.trim())
                : [],
          }),
        ),
      };
    }),
    Effect.map(({ hours, breaks, fills, overfills, standbys }) =>
      pipe(
        new ArrayWithDefault({ array: hours, default: { hour: Number.NaN } }),
        ArrayWithDefault.zip(
          new ArrayWithDefault({
            array: breaks,
            default: { breakHour: false },
          }),
        ),
        ArrayWithDefault.zip(
          new ArrayWithDefault({
            array: fills,
            default: {
              fills: [undefined, undefined, undefined, undefined, undefined],
            },
          }),
        ),
        ArrayWithDefault.zip(
          new ArrayWithDefault({
            array: overfills,
            default: { overfills: [] },
          }),
        ),
        ArrayWithDefault.zip(
          new ArrayWithDefault({
            array: standbys,
            default: { standbys: [] },
          }),
        ),
        ArrayWithDefault.zipMap(({ fills, overfills }) => ({
          empty: Order.max(Order.number)(
            5 - fills.filter(Boolean).length - overfills.length,
            0,
          ),
        })),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.filter(({ hour }) => !isNaN(hour)),
        collectArrayToHashMap({
          keyGetter: ({ hour }) => hour,
          keyValueReducer: (_, b) => b,
        }),
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
        Effect.bindAll(
          ({ sheetConfigService }) => ({
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
            dayConfig: Effect.cached(
              pipe(
                sheetConfigService.getDayConfig(sheetId),
                Effect.withSpan("SheetService.dayConfig", {
                  captureStackTrace: true,
                }),
              ),
            ),
          }),
          { concurrency: "unbounded" },
        ),
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
        Effect.bindAll(
          ({ sheetGet, rangesConfig }) => ({
            players: Effect.cached(
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
                Effect.withSpan("SheetService.players", {
                  captureStackTrace: true,
                }),
              ),
            ),
            teams: Effect.cached(
              pipe(
                Effect.Do,
                Effect.bind("rangesConfig", () => rangesConfig),
                Effect.bind("sheet", ({ rangesConfig }) =>
                  sheetGet({
                    ranges: [rangesConfig.userIds, rangesConfig.userTeams],
                  }),
                ),
                Effect.flatMap(({ sheet }) =>
                  teamParser(sheet.data.valueRanges),
                ),
                Effect.withSpan("SheetService.teams", {
                  captureStackTrace: true,
                }),
              ),
            ),
            allSchedules: Effect.cached(
              pipe(
                Effect.Do,
                Effect.bindAll(
                  () => ({
                    rangesConfig,
                  }),
                  { concurrency: "unbounded" },
                ),
                Effect.bind("sheet", ({ rangesConfig }) =>
                  sheetGet({
                    ranges: [
                      rangesConfig.hours,
                      rangesConfig.breaks,
                      rangesConfig.fills,
                      rangesConfig.overfills,
                      rangesConfig.standbys,
                    ],
                  }),
                ),
                Effect.bind("schedules", ({ sheet }) =>
                  scheduleParser(sheet.data.valueRanges),
                ),
                Effect.map(({ schedules }) => schedules),
                Effect.withSpan("SheetService.allSchedules", {
                  captureStackTrace: true,
                }),
              ),
            ),
          }),
          { concurrency: "unbounded" },
        ),
        Effect.map(
          ({
            sheetGet,
            sheetUpdate,
            rangesConfig,
            eventConfig,
            dayConfig,
            players,
            teams,
            allSchedules,
          }) => ({
            get: sheetGet,
            update: sheetUpdate,
            getRangesConfig: () =>
              pipe(
                rangesConfig,
                Effect.withSpan("SheetService.getRangesConfig"),
              ),
            getEventConfig: () =>
              pipe(eventConfig, Effect.withSpan("SheetService.getEventConfig")),
            getDayConfig: () =>
              pipe(dayConfig, Effect.withSpan("SheetService.getDayConfig")),
            getPlayers: () =>
              pipe(
                players,
                Effect.withSpan("SheetService.getPlayers", {
                  captureStackTrace: true,
                }),
              ),
            getTeams: () =>
              pipe(
                teams,
                Effect.withSpan("SheetService.getTeams", {
                  captureStackTrace: true,
                }),
              ),
            getAllSchedules: () =>
              pipe(
                allSchedules,
                Effect.withSpan("SheetService.getAllSchedules", {
                  captureStackTrace: true,
                }),
              ),
            getDaySchedules: (day: number) =>
              pipe(
                Effect.Do,
                Effect.bindAll(
                  () => ({
                    rangesConfig,
                    dayConfig,
                  }),
                  { concurrency: "unbounded" },
                ),
                Effect.bind("sheet", ({ dayConfig }) =>
                  pipe(
                    HashMap.get(dayConfig, day),
                    Effect.flatMap((config) =>
                      sheetGet({
                        ranges: [
                          `'${config.sheet}'!J3:J`,
                          `'${config.sheet}'!C3:C`,
                          `'${config.sheet}'!K3:O`,
                          `'${config.sheet}'!P3:P`,
                          `'${config.sheet}'!Q3:Q`,
                        ],
                      }),
                    ),
                  ),
                ),
                Effect.bind("schedules", ({ sheet }) =>
                  scheduleParser(sheet.data.valueRanges),
                ),
                Effect.map(({ schedules }) => schedules),
                Effect.withSpan("SheetService.getDaySchedules", {
                  captureStackTrace: true,
                }),
              ),
          }),
        ),
      ),
    dependencies: [GoogleSheets.Default, SheetConfigService.Default],
    accessors: true,
  },
) {
  static ofGuild(guildId: string) {
    return pipe(
      Effect.Do,
      Effect.bind("guildConfig", () =>
        pipe(
          GuildConfigService.getConfig(guildId),
          Effect.flatMap((computed) => observeOnce(computed.value)),
        ),
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
