import { type MethodOptions, type sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Data,
  Effect,
  HashMap,
  Layer,
  Option,
  Order,
  pipe,
} from "effect";
import { observeOnce } from "typhoon-server/signal";
import { ArrayWithDefault, collectArrayToHashMap } from "typhoon-server/utils";
import { GoogleSheets } from "../../google/sheets";
import { bindObject } from "../../utils";
import { SheetConfigService, TeamConfig } from "../bot/sheetConfigService";
import { GuildConfigService } from "./guildConfigService";

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
  idIndex: number;
  name: Option.Option<string>;
  nameIndex: number;
}> {}

const playerParser = ([
  userIds,
  userSheetNames,
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<RawPlayer[], never, never> =>
  pipe(
    Effect.Do,
    bindObject({
      userIds: parseValueRange(userIds, ([userId], index) =>
        Effect.succeed({
          id: pipe(Option.fromNullable(userId), Option.map(String)),
          idIndex: index,
        }),
      ),
      userSheetNames: parseValueRange(
        userSheetNames,
        ([userSheetName], index) =>
          Effect.succeed({
            name: pipe(Option.fromNullable(userSheetName), Option.map(String)),
            nameIndex: index,
          }),
      ),
    }),
    Effect.map(({ userIds, userSheetNames }) =>
      pipe(
        new ArrayWithDefault({
          array: userIds,
          default: { id: Option.none(), idIndex: Number.NaN },
        }),
        ArrayWithDefault.zip(
          new ArrayWithDefault({
            array: userSheetNames,
            default: { name: Option.none(), nameIndex: Number.NaN },
          }),
        ),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.map((value) => new RawPlayer(value)),
      ),
    ),
    Effect.withSpan("playerParser", { captureStackTrace: true }),
  );

export class RawTeam extends Data.TaggedClass("RawTeam")<{
  type: string;
  name: string;
  tags: string[];
  lead: Option.Option<number>;
  backline: Option.Option<number>;
  talent: Option.Option<number>;
}> {}

const teamParser = (
  teamConfigValues: TeamConfig[],
  [userIds, ...userTeams]: sheets_v4.Schema$ValueRange[],
): Effect.Effect<
  HashMap.HashMap<string, { id: string; teams: RawTeam[] }>,
  never,
  never
> =>
  pipe(
    Effect.Do,
    bindObject({
      userIds: parseValueRange(userIds, ([userId]) =>
        Effect.succeed({
          id: pipe(Option.fromNullable(userId), Option.map(String)),
        }),
      ),
      userTeams: pipe(
        Array.zip(teamConfigValues, userTeams),
        Effect.forEach(
          ([teamConfig, userTeams]) =>
            parseValueRange(
              userTeams,
              ([name, _isv, lead, backline, talent, _isvPercent]) =>
                Effect.succeed({
                  type: teamConfig.name,
                  name: pipe(Option.fromNullable(name), Option.map(String)),
                  tags: teamConfig.tags,
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
          { concurrency: "unbounded" },
        ),
        Effect.map((teams) =>
          pipe(
            teams[0].map((_, i) => teams.map((row) => row[i])),
            Array.map((teams) => ({ teams })),
          ),
        ),
      ),
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
                Array.map(({ type, name, tags, lead, backline, talent }) =>
                  pipe(
                    name,
                    Option.map(
                      (name) =>
                        new RawTeam({
                          type,
                          name,
                          tags,
                          lead,
                          backline,
                          talent,
                        }),
                    ),
                    Option.filter(({ name }) => name !== ""),
                  ),
                ),
                Array.getSomes,
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

const scheduleParser = ([
  hours,
  breaks,
  fills,
  overfills,
  standbys,
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<ScheduleMap, never, never> =>
  pipe(
    Effect.Do,
    bindObject({
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
        bindObject({
          sheet: GoogleSheets,
          sheetConfigService: SheetConfigService,
        }),
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
            teamConfig: Effect.cached(
              pipe(
                sheetConfigService.getTeamConfig(sheetId),
                Effect.withSpan("SheetService.teamConfig", {
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
          ({ sheetGet, rangesConfig, teamConfig }) => ({
            players: pipe(
              Effect.Do,
              Effect.bind("rangesConfig", () => rangesConfig),
              Effect.bind("sheet", ({ rangesConfig }) =>
                sheetGet({
                  ranges: [rangesConfig.userIds, rangesConfig.userSheetNames],
                }),
              ),
              Effect.flatMap(({ sheet }) =>
                playerParser(sheet.data.valueRanges ?? []),
              ),
              Effect.withSpan("SheetService.players", {
                captureStackTrace: true,
              }),
              Effect.cached,
            ),
            teams: pipe(
              Effect.Do,
              Effect.bind("rangesConfig", () => rangesConfig),
              Effect.bind("teamConfig", () => teamConfig),
              Effect.let("teamConfigValues", ({ teamConfig }) =>
                HashMap.toValues(teamConfig),
              ),
              Effect.bind("sheet", ({ rangesConfig, teamConfigValues }) =>
                sheetGet({
                  ranges: [
                    rangesConfig.userIds,
                    ...pipe(
                      teamConfigValues,
                      Array.map(({ range }) => range),
                    ),
                  ],
                }),
              ),
              Effect.flatMap(({ teamConfigValues, sheet }) =>
                teamParser(teamConfigValues, sheet.data.valueRanges ?? []),
              ),
              Effect.withSpan("SheetService.teams", {
                captureStackTrace: true,
              }),
              Effect.cached,
            ),
            allSchedules: pipe(
              Effect.Do,
              bindObject({
                rangesConfig,
              }),
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
                scheduleParser(sheet.data.valueRanges ?? []),
              ),
              Effect.map(({ schedules }) => schedules),
              Effect.withSpan("SheetService.allSchedules", {
                captureStackTrace: true,
              }),
              Effect.cached,
            ),
          }),
          { concurrency: "unbounded" },
        ),
        Effect.map(
          ({
            sheetGet,
            sheetUpdate,
            rangesConfig,
            teamConfig,
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
                Effect.withSpan("SheetService.getRangesConfig", {
                  captureStackTrace: true,
                }),
              ),
            getTeamConfig: () =>
              pipe(
                teamConfig,
                Effect.withSpan("SheetService.getTeamConfig", {
                  captureStackTrace: true,
                }),
              ),
            getEventConfig: () =>
              pipe(
                eventConfig,
                Effect.withSpan("SheetService.getEventConfig", {
                  captureStackTrace: true,
                }),
              ),
            getDayConfig: () =>
              pipe(
                dayConfig,
                Effect.withSpan("SheetService.getDayConfig", {
                  captureStackTrace: true,
                }),
              ),
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
                bindObject({
                  rangesConfig,
                  dayConfig,
                }),
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
                  scheduleParser(sheet.data.valueRanges ?? []),
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
  static ofGuild() {
    return pipe(
      Effect.Do,
      Effect.bind("guildConfig", () =>
        pipe(GuildConfigService.getConfig(), Effect.flatMap(observeOnce)),
      ),
      Effect.bind("sheetId", ({ guildConfig }) =>
        pipe(
          guildConfig,
          Option.flatMap((guildConfig) => guildConfig.sheetId),
        ),
      ),
      Effect.map(({ sheetId }) =>
        SheetService.DefaultWithoutDependencies(sheetId),
      ),
      Effect.withSpan("SheetService.ofGuild", { captureStackTrace: true }),
      Layer.unwrapEffect,
    );
  }
}
