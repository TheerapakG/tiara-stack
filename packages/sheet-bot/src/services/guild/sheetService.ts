import { type MethodOptions, type sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Data,
  Effect,
  Equal,
  HashMap,
  Layer,
  Option,
  Order,
  pipe,
  String,
} from "effect";
import { observeOnce } from "typhoon-server/signal";
import { ArrayWithDefault, collectArrayToHashMap } from "typhoon-server/utils";
import { GoogleSheets } from "../../google/sheets";
import { bindObject } from "../../utils";
import { SheetConfigService, TeamConfig } from "../bot/sheetConfigService";
import { GuildConfigService } from "./guildConfigService";

const parseValueRange = <A = never, E = never, R = never>(
  valueRange: sheets_v4.Schema$ValueRange,
  rowParser: (
    row: readonly Option.Option<string>[],
    index: number,
  ) => Effect.Effect<A, E, R>,
): Effect.Effect<A[], E, R> =>
  pipe(
    Option.fromNullable(valueRange.values),
    Option.map(
      Array.map(
        Array.map((v) =>
          Equal.equals(v, "")
            ? Option.none()
            : Option.fromNullable(v as string | null | undefined),
        ),
      ),
    ),
    Option.map(Effect.forEach(rowParser)),
    Option.getOrElse(() => Effect.succeed([])),
    Effect.withSpan("parseValueRange", { captureStackTrace: true }),
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
      userIds: parseValueRange(userIds, (arr, index) =>
        Effect.succeed({
          id: pipe(Array.get(arr, 0), Option.flatten),
          idIndex: index,
        }),
      ),
      userSheetNames: parseValueRange(userSheetNames, (arr, index) =>
        Effect.succeed({
          name: pipe(Array.get(arr, 0), Option.flatten),
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

export class Team extends Data.TaggedClass("Team")<{
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
  HashMap.HashMap<string, { id: string; teams: Team[] }>,
  never,
  never
> =>
  pipe(
    Effect.Do,
    bindObject({
      userIds: parseValueRange(userIds, (arr) =>
        Effect.succeed({
          id: pipe(Array.get(arr, 0), Option.flatten),
        }),
      ),
      userTeams: pipe(
        Array.zip(teamConfigValues, userTeams),
        Effect.forEach(
          ([teamConfig, userTeams]) =>
            parseValueRange(userTeams, (arr) =>
              Effect.succeed({
                type: teamConfig.name,
                name: pipe(Array.get(arr, 0), Option.flatten),
                tags: teamConfig.tags,
                lead: pipe(
                  Array.get(arr, 2),
                  Option.flatten,
                  Option.flatMapNullable((lead) => parseInt(lead, 10)),
                ),
                backline: pipe(
                  Array.get(arr, 3),
                  Option.flatten,
                  Option.flatMapNullable((backline) => parseInt(backline, 10)),
                ),
                talent: pipe(
                  Array.get(arr, 4),
                  Option.flatten,
                  Option.flatMapNullable((talent) => parseInt(talent, 10)),
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
                        new Team({
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
          valueInitializer: (a) => a,
          valueReducer: (acc, a) => ({
            id: acc.id,
            teams: Array.appendAll(acc.teams, a.teams),
          }),
        }),
      ),
    ),
    Effect.withSpan("playerParser", { captureStackTrace: true }),
  );

export class Schedule extends Data.TaggedClass("Schedule")<{
  hour: number;
  breakHour: boolean;
  fills: readonly [
    Option.Option<string>,
    Option.Option<string>,
    Option.Option<string>,
    Option.Option<string>,
    Option.Option<string>,
  ];
  overfills: string[];
  standbys: string[];
  empty: number;
}> {
  static empty(hour: number) {
    return new Schedule({
      hour,
      breakHour: false,
      fills: [
        Option.none(),
        Option.none(),
        Option.none(),
        Option.none(),
        Option.none(),
      ],
      overfills: [],
      standbys: [],
      empty: 5,
    });
  }
}
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
      hours: parseValueRange(hours, (arr) =>
        Effect.succeed({
          hour: pipe(
            Array.get(arr, 0),
            Option.flatten,
            Option.flatMapNullable((v) => parseInt(v, 10)),
          ),
        }),
      ),
      breaks: parseValueRange(breaks, (arr) =>
        Effect.succeed({
          breakHour: pipe(
            Array.get(arr, 0),
            Option.flatten,
            Option.map((v) => v === "TRUE"),
            Option.getOrElse(() => false),
          ),
        }),
      ),
      fills: parseValueRange(fills, (arr) =>
        Effect.succeed({
          fills: [
            pipe(Array.get(arr, 0), Option.flatten),
            pipe(Array.get(arr, 1), Option.flatten),
            pipe(Array.get(arr, 2), Option.flatten),
            pipe(Array.get(arr, 3), Option.flatten),
            pipe(Array.get(arr, 4), Option.flatten),
          ] as const,
        }),
      ),
      overfills: parseValueRange(overfills, (arr) =>
        Effect.succeed({
          overfills: pipe(
            Array.get(arr, 0),
            Option.flatten,
            Option.map((v) =>
              pipe(v, String.split(","), Array.map(String.trim)),
            ),
            Option.getOrElse(() => []),
          ),
        }),
      ),
      standbys: parseValueRange(standbys, (arr) =>
        Effect.succeed({
          standbys: pipe(
            Array.get(arr, 0),
            Option.flatten,
            Option.map((v) =>
              pipe(v, String.split(","), Array.map(String.trim)),
            ),
            Option.getOrElse(() => []),
          ),
        }),
      ),
    }),
    Effect.map(({ hours, breaks, fills, overfills, standbys }) =>
      pipe(
        new ArrayWithDefault({
          array: hours,
          default: { hour: Option.none() },
        }),
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
              fills: [
                Option.none(),
                Option.none(),
                Option.none(),
                Option.none(),
                Option.none(),
              ] as const,
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
        ArrayWithDefault.map(
          ({ hour, breakHour, fills, overfills, standbys }) =>
            pipe(
              hour,
              Option.map(
                (hour) =>
                  new Schedule({
                    hour,
                    breakHour,
                    fills,
                    overfills,
                    standbys,
                    empty: Order.max(Order.number)(
                      5 - fills.filter(Option.isSome).length - overfills.length,
                      0,
                    ),
                  }),
              ),
            ),
        ),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.getSomes,
        collectArrayToHashMap({
          keyGetter: ({ hour }) => hour,
          valueInitializer: (a) => a,
          valueReducer: (_, a) => a,
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
            runnerConfig: Effect.cached(
              pipe(
                sheetConfigService.getRunnerConfig(sheetId),
                Effect.withSpan("SheetService.runnerConfig", {
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
            runnerConfig,
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
            getRunnerConfig: () =>
              pipe(
                runnerConfig,
                Effect.withSpan("SheetService.getRunnerConfig", {
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
                    dayConfig,
                    collectArrayToHashMap({
                      keyGetter: ({ day }) => day,
                      valueInitializer: (a) => [a],
                      valueReducer: (acc, a) => Array.append(acc, a),
                    }),
                    HashMap.get(day),
                    // TODO: parse multiple sheets
                    Effect.flatMap((config) =>
                      sheetGet({
                        ranges: [
                          `'${config[0].sheet}'!J3:J`,
                          `'${config[0].sheet}'!C3:C`,
                          `'${config[0].sheet}'!K3:O`,
                          `'${config[0].sheet}'!P3:P`,
                          `'${config[0].sheet}'!Q3:Q`,
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
