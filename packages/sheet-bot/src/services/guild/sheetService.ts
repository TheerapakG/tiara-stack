import { GoogleSheets } from "@/google/sheets";
import {
  HourRange,
  RunnerConfigMap,
  SheetConfigService,
  TeamConfig,
} from "@/services/bot/sheetConfigService";
import { bindObject } from "@/utils";
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
        Effect.forEach(([teamConfig, userTeams]) =>
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
  fills: readonly Option.Option<string>[];
  overfills: readonly string[];
  standbys: readonly string[];
  empty: number;
}> {
  static empty(hour: number, breakHour?: boolean) {
    return new Schedule({
      hour,
      breakHour: breakHour ?? false,
      fills: Array.makeBy(5, () => Option.none()),
      overfills: [],
      standbys: [],
      empty: 5,
    });
  }

  static make({
    hour,
    breakHour,
    fills,
    overfills,
    standbys,
  }: {
    hour: number;
    breakHour: boolean;
    fills: readonly Option.Option<string>[];
    overfills: readonly string[];
    standbys: readonly string[];
  }) {
    return breakHour
      ? Schedule.empty(hour, breakHour)
      : new Schedule({
          hour,
          breakHour,
          fills,
          overfills,
          standbys,
          empty: Order.max(Order.number)(
            5 - fills.filter(Option.isSome).length - overfills.length,
            0,
          ),
        });
  }
}
export type ScheduleMap = HashMap.HashMap<number, Schedule>;

const scheduleParser = (
  [hours, fills, overfills, standbys, breaks]: sheets_v4.Schema$ValueRange[],
  { detectBreak }: { detectBreak?: RunnerConfigMap },
): Effect.Effect<ScheduleMap, never, never> =>
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
      fills: parseValueRange(fills, (arr) =>
        Effect.succeed({
          fills: Array.makeBy(5, (i) =>
            pipe(Array.get(arr, i), Option.flatten),
          ),
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
      breaks: detectBreak
        ? Effect.succeed([])
        : parseValueRange(breaks, (arr) =>
            Effect.succeed({
              breakHour: pipe(
                Array.get(arr, 0),
                Option.flatten,
                Option.map((v) => String.Equivalence(v, "TRUE")),
                Option.getOrElse(() => false),
              ),
            }),
          ),
    }),
    Effect.map(({ hours, fills, overfills, standbys, breaks }) =>
      pipe(
        new ArrayWithDefault({
          array: hours,
          default: { hour: Option.none() },
        }),
        ArrayWithDefault.zip(
          new ArrayWithDefault({
            array: fills,
            default: {
              fills: Array.makeBy(5, () => Option.none()),
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
        ArrayWithDefault.zip(
          new ArrayWithDefault({
            array: breaks,
            default: { breakHour: false },
          }),
        ),
        ArrayWithDefault.map(
          ({ hour, breakHour, fills, overfills, standbys }) =>
            pipe(
              hour,
              Option.map((hour) =>
                Schedule.make({
                  hour,
                  breakHour: detectBreak
                    ? pipe(
                        fills,
                        Array.getSomes,
                        Array.map((fill) =>
                          pipe(detectBreak, HashMap.get(fill)),
                        ),
                        Array.getSomes,
                        Array.filter((config) =>
                          pipe(
                            config.hours,
                            Array.some(HourRange.includes(hour)),
                          ),
                        ),
                        Array.isEmptyArray,
                      )
                    : breakHour,
                  fills,
                  overfills,
                  standbys,
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
          ({ sheetGet, rangesConfig, teamConfig, runnerConfig }) => ({
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
                runnerConfig,
              }),
              Effect.bind("sheet", ({ rangesConfig }) =>
                sheetGet({
                  ranges: pipe(
                    [
                      Option.some(rangesConfig.hours),
                      Option.some(rangesConfig.fills),
                      Option.some(rangesConfig.overfills),
                      Option.some(rangesConfig.standbys),
                      String.Equivalence(rangesConfig.breaks, "detect")
                        ? Option.none()
                        : Option.some(rangesConfig.breaks),
                    ],
                    Array.getSomes,
                  ),
                }),
              ),
              Effect.bind(
                "schedules",
                ({ sheet, rangesConfig, runnerConfig }) =>
                  scheduleParser(sheet.data.valueRanges ?? [], {
                    detectBreak: String.Equivalence(
                      rangesConfig.breaks,
                      "detect",
                    )
                      ? runnerConfig
                      : undefined,
                  }),
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
                  runnerConfig,
                }),
                Effect.bind("specificDayConfig", ({ dayConfig }) =>
                  pipe(
                    dayConfig,
                    collectArrayToHashMap({
                      keyGetter: ({ day }) => day,
                      valueInitializer: (a) => [a],
                      valueReducer: (acc, a) => Array.append(acc, a),
                    }),
                    HashMap.get(day),
                  ),
                ),
                Effect.bind("sheet", ({ specificDayConfig }) =>
                  sheetGet({
                    ranges: pipe(
                      [
                        Option.some(
                          `'${specificDayConfig[0].sheet}'!${specificDayConfig[0].hourRange}`,
                        ),
                        Option.some(
                          `'${specificDayConfig[0].sheet}'!${specificDayConfig[0].fillRange}`,
                        ),
                        Option.some(
                          `'${specificDayConfig[0].sheet}'!${specificDayConfig[0].overfillRange}`,
                        ),
                        Option.some(
                          `'${specificDayConfig[0].sheet}'!${specificDayConfig[0].standbyRange}`,
                        ),
                        String.Equivalence(
                          specificDayConfig[0].breakRange,
                          "detect",
                        )
                          ? Option.none()
                          : Option.some(
                              `'${specificDayConfig[0].sheet}'!${specificDayConfig[0].breakRange}`,
                            ),
                      ],
                      Array.getSomes,
                    ),
                  }),
                ),
                Effect.bind(
                  "schedules",
                  ({ specificDayConfig, sheet, runnerConfig }) =>
                    scheduleParser(sheet.data.valueRanges ?? [], {
                      detectBreak: String.Equivalence(
                        specificDayConfig[0].breakRange,
                        "detect",
                      )
                        ? runnerConfig
                        : undefined,
                    }),
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
