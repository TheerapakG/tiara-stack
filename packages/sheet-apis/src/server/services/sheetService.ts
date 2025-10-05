import { GoogleSheets } from "@/google/sheets";
import {
  HourRange,
  RawPlayer,
  Schedule,
  Team,
  TeamConfig,
} from "@/server/schema";
import { type MethodOptions, type sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Effect,
  HashMap,
  Match,
  Number,
  Option,
  Order,
  pipe,
  String,
} from "effect";
import { Computed } from "typhoon-core/signal";
import { Array as ArrayUtils } from "typhoon-core/utils";
import { GuildConfigService } from "./guildConfigService";
import { RunnerConfigMap, SheetConfigService } from "./sheetConfigService";

const playerParser = ([
  userIds,
  userSheetNames,
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<RawPlayer[], never, never> =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => ({
      userIds: GoogleSheets.parseValueRange(userIds, (arr, index) =>
        Effect.succeed({
          id: pipe(Array.get(arr, 0), Option.flatten),
          idIndex: index,
        }),
      ),
      userSheetNames: GoogleSheets.parseValueRange(
        userSheetNames,
        (arr, index) =>
          Effect.succeed({
            name: pipe(Array.get(arr, 0), Option.flatten),
            nameIndex: index,
          }),
      ),
    })),
    Effect.map(({ userIds, userSheetNames }) =>
      pipe(
        new ArrayUtils.WithDefault.ArrayWithDefault({
          array: userIds,
          default: { id: Option.none(), idIndex: globalThis.Number.NaN },
        }),
        ArrayUtils.WithDefault.zip(
          new ArrayUtils.WithDefault.ArrayWithDefault({
            array: userSheetNames,
            default: { name: Option.none(), nameIndex: globalThis.Number.NaN },
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

const teamParser = (
  teamConfigValues: TeamConfig[],
  sheet: HashMap.HashMap<string, sheets_v4.Schema$ValueRange>,
) =>
  pipe(
    teamConfigValues,
    Effect.forEach((teamConfig) =>
      pipe(
        Effect.Do,
        Effect.bindAll(() => ({
          playerName: pipe(
            sheet,
            HashMap.get(`${teamConfig.name}!playerName`),
            Effect.flatMap((playerName) =>
              GoogleSheets.parseValueRange(playerName, (arr) =>
                Effect.succeed({
                  playerName: pipe(Array.get(arr, 0), Option.flatten),
                }),
              ),
            ),
          ),
          teamName: pipe(
            sheet,
            HashMap.get(`${teamConfig.name}!teamName`),
            Effect.flatMap((teamName) =>
              GoogleSheets.parseValueRange(teamName, (arr) =>
                Effect.succeed({
                  teamName: pipe(Array.get(arr, 0), Option.flatten),
                }),
              ),
            ),
          ),
          lead: pipe(
            sheet,
            HashMap.get(`${teamConfig.name}!lead`),
            Effect.flatMap((lead) =>
              GoogleSheets.parseValueRange(lead, (arr) =>
                Effect.succeed({
                  lead: pipe(
                    Array.get(arr, 0),
                    Option.flatten,
                    Option.flatMapNullable((lead) => parseInt(lead, 10)),
                  ),
                }),
              ),
            ),
          ),
          backline: pipe(
            sheet,
            HashMap.get(`${teamConfig.name}!backline`),
            Effect.flatMap((backline) =>
              GoogleSheets.parseValueRange(backline, (arr) =>
                Effect.succeed({
                  backline: pipe(
                    Array.get(arr, 0),
                    Option.flatten,
                    Option.flatMapNullable((backline) =>
                      parseInt(backline, 10),
                    ),
                  ),
                }),
              ),
            ),
          ),
          talent: pipe(
            sheet,
            HashMap.get(`${teamConfig.name}!talent`),
            Effect.flatMap((talent) =>
              GoogleSheets.parseValueRange(talent, (arr) =>
                Effect.succeed({
                  talent: pipe(
                    Array.get(arr, 0),
                    Option.flatten,
                    Option.flatMapNullable((talent) => parseInt(talent, 10)),
                  ),
                }),
              ),
            ),
          ),
          tags: pipe(
            Match.value(teamConfig.tagsConfig),
            Match.tagsExhaustive({
              TeamTagsConstantsConfig: () => Effect.succeed([]),
              TeamTagsRangesConfig: () =>
                pipe(
                  sheet,
                  HashMap.get(`${teamConfig.name}!tags`),
                  Effect.flatMap((tags) =>
                    GoogleSheets.parseValueRange(tags, (arr) =>
                      Effect.succeed({
                        tags: pipe(
                          Array.get(arr, 0),
                          Option.flatten,
                          Option.map(String.split(",")),
                          Option.map(Array.map(String.trim)),
                          Option.getOrElse(() => []),
                        ),
                      }),
                    ),
                  ),
                ),
            }),
          ),
        })),
        Effect.map(({ playerName, teamName, lead, backline, talent, tags }) =>
          pipe(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: playerName,
              default: { playerName: Option.none() },
            }),
            ArrayUtils.WithDefault.zip(
              new ArrayUtils.WithDefault.ArrayWithDefault({
                array: teamName,
                default: { teamName: Option.none() },
              }),
            ),
            ArrayUtils.WithDefault.zip(
              new ArrayUtils.WithDefault.ArrayWithDefault({
                array: lead,
                default: { lead: Option.none() },
              }),
            ),
            ArrayUtils.WithDefault.zip(
              new ArrayUtils.WithDefault.ArrayWithDefault({
                array: backline,
                default: { backline: Option.none() },
              }),
            ),
            ArrayUtils.WithDefault.zip(
              new ArrayUtils.WithDefault.ArrayWithDefault({
                array: talent,
                default: { talent: Option.none() },
              }),
            ),
            ArrayUtils.WithDefault.zip(
              new ArrayUtils.WithDefault.ArrayWithDefault({
                array: tags,
                default: {
                  tags: pipe(
                    Match.value(teamConfig.tagsConfig),
                    Match.tagsExhaustive({
                      TeamTagsConstantsConfig: (teamConfig) => teamConfig.tags,
                      TeamTagsRangesConfig: () => [],
                    }),
                  ),
                },
              }),
            ),
          ),
        ),
        Effect.map(({ array }) =>
          pipe(
            array,
            Array.map(
              ({ playerName, teamName, lead, backline, talent, tags }) =>
                pipe(
                  Option.Do,
                  Option.bind("playerName", () => playerName),
                  Option.bind("teamName", () => teamName),
                  Option.map(({ playerName, teamName }) => ({
                    name: playerName,
                    team: new Team({
                      type: teamConfig.name,
                      name: teamName,
                      tags,
                      lead,
                      backline,
                      talent,
                    }),
                  })),
                ),
            ),
            Array.getSomes,
          ),
        ),
      ),
    ),
    Effect.map(Array.flatten),
    Effect.map((array) =>
      pipe(
        array,
        ArrayUtils.Collect.toHashMap({
          keyGetter: ({ name }) => name,
          valueInitializer: ({ name, team }) => ({ name, teams: [team] }),
          valueReducer: ({ name, teams }, { team }) => ({
            name,
            teams: Array.append(teams, team),
          }),
        }),
      ),
    ),
    Effect.map(
      HashMap.map(({ name, teams }) => ({
        name,
        teams: pipe(
          teams,
          Array.sortWith(
            Team.getEffectValue,
            Order.reverse(Option.getOrder(Number.Order)),
          ),
        ),
      })),
    ),
    Effect.withSpan("teamParser", { captureStackTrace: true }),
  );

export type ScheduleMap = HashMap.HashMap<number, Schedule>;

const scheduleParser = (
  [hours, fills, overfills, standbys, breaks]: sheets_v4.Schema$ValueRange[],
  { detectBreak }: { detectBreak?: RunnerConfigMap },
): Effect.Effect<ScheduleMap, never, never> =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => ({
      hours: GoogleSheets.parseValueRange(hours, (arr) =>
        Effect.succeed({
          hour: pipe(
            Array.get(arr, 0),
            Option.flatten,
            Option.flatMapNullable((v) => parseInt(v, 10)),
          ),
        }),
      ),
      fills: GoogleSheets.parseValueRange(fills, (arr) =>
        Effect.succeed({
          fills: Array.makeBy(5, (i) =>
            pipe(Array.get(arr, i), Option.flatten),
          ),
        }),
      ),
      overfills: GoogleSheets.parseValueRange(overfills, (arr) =>
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
      standbys: GoogleSheets.parseValueRange(standbys, (arr) =>
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
        : GoogleSheets.parseValueRange(breaks, (arr) =>
            Effect.succeed({
              breakHour: pipe(
                Array.get(arr, 0),
                Option.flatten,
                Option.map((v) => String.Equivalence(v, "TRUE")),
                Option.getOrElse(() => false),
              ),
            }),
          ),
    })),
    Effect.map(({ hours, fills, overfills, standbys, breaks }) =>
      pipe(
        new ArrayUtils.WithDefault.ArrayWithDefault({
          array: hours,
          default: { hour: Option.none() },
        }),
        ArrayUtils.WithDefault.zip(
          new ArrayUtils.WithDefault.ArrayWithDefault({
            array: fills,
            default: {
              fills: Array.makeBy(5, () => Option.none()),
            },
          }),
        ),
        ArrayUtils.WithDefault.zip(
          new ArrayUtils.WithDefault.ArrayWithDefault({
            array: overfills,
            default: { overfills: [] },
          }),
        ),
        ArrayUtils.WithDefault.zip(
          new ArrayUtils.WithDefault.ArrayWithDefault({
            array: standbys,
            default: { standbys: [] },
          }),
        ),
        ArrayUtils.WithDefault.zip(
          new ArrayUtils.WithDefault.ArrayWithDefault({
            array: breaks,
            default: { breakHour: false },
          }),
        ),
        ArrayUtils.WithDefault.map(
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
              Option.map(Schedule.toEmptyIfBreak),
            ),
        ),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.getSomes,
        ArrayUtils.Collect.toHashMap({
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
        Effect.bindAll(() => ({
          sheet: GoogleSheets,
          sheetConfigService: SheetConfigService,
        })),
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
          "sheetGetHashMap",
          ({ sheet }) =>
            <K>(
              ranges: HashMap.HashMap<K, string>,
              defaultKey: K,
              params?: Omit<
                sheets_v4.Params$Resource$Spreadsheets$Values$Batchget,
                "spreadsheetId"
              >,
              options?: MethodOptions,
            ) =>
              pipe(
                sheet.getHashMap(
                  ranges,
                  defaultKey,
                  { spreadsheetId: sheetId, ...params },
                  options,
                ),
                Effect.withSpan("SheetService.getHashMap", {
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
          ({
            sheetGet,
            sheetGetHashMap,
            rangesConfig,
            teamConfig,
            runnerConfig,
          }) => ({
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
              Effect.bind("teamConfig", () => teamConfig),
              Effect.let("teamConfigValues", ({ teamConfig }) =>
                HashMap.toValues(teamConfig),
              ),
              Effect.let("ranges", ({ teamConfigValues }) =>
                pipe(
                  teamConfigValues,
                  Array.reduce(
                    HashMap.empty<string, Option.Option<string>>(),
                    (acc, a) =>
                      pipe(
                        acc,
                        HashMap.set(
                          `${a.name}!playerName`,
                          Option.some(`'${a.sheet}'!${a.playerNameRange}`),
                        ),
                        HashMap.set(
                          `${a.name}!teamName`,
                          Option.some(`'${a.sheet}'!${a.teamNameRange}`),
                        ),
                        HashMap.set(
                          `${a.name}!lead`,
                          Option.some(`'${a.sheet}'!${a.leadRange}`),
                        ),
                        HashMap.set(
                          `${a.name}!backline`,
                          Option.some(`'${a.sheet}'!${a.backlineRange}`),
                        ),
                        HashMap.set(
                          `${a.name}!talent`,
                          Option.some(`'${a.sheet}'!${a.talentRange}`),
                        ),
                        HashMap.set(
                          `${a.name}!tags`,
                          pipe(
                            Match.value(a.tagsConfig),
                            Match.tag("TeamTagsRangesConfig", (tagsConfig) =>
                              Option.some(
                                `'${a.sheet}'!${tagsConfig.tagsRange}`,
                              ),
                            ),
                            Match.orElse(() => Option.none()),
                          ),
                        ),
                      ),
                  ),
                  HashMap.filterMap((a, _) => a),
                ),
              ),
              Effect.bind("sheet", ({ ranges }) => sheetGetHashMap(ranges, "")),
              Effect.flatMap(({ teamConfigValues, sheet }) =>
                teamParser(teamConfigValues, sheet),
              ),
              Effect.withSpan("SheetService.teams", {
                captureStackTrace: true,
              }),
              Effect.cached,
            ),
            allSchedules: pipe(
              Effect.Do,
              Effect.bindAll(() => ({
                rangesConfig,
                runnerConfig,
              })),
              Effect.bind("sheet", ({ rangesConfig }) =>
                sheetGet({
                  ranges: pipe(
                    [
                      Option.some(rangesConfig.hours),
                      Option.some(rangesConfig.fills),
                      Option.some(rangesConfig.overfills),
                      Option.some(rangesConfig.standbys),
                      pipe(
                        rangesConfig.breaks,
                        Option.liftPredicate(
                          () =>
                            !String.Equivalence(rangesConfig.breaks, "detect"),
                        ),
                      ),
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
            sheetGetHashMap,
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
            getHashMap: () => sheetGetHashMap,
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
                Effect.bindAll(() => ({
                  rangesConfig,
                  dayConfig,
                  runnerConfig,
                })),
                Effect.bind("specificDayConfig", ({ dayConfig }) =>
                  pipe(
                    dayConfig,
                    ArrayUtils.Collect.toHashMap({
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
                        pipe(
                          `'${specificDayConfig[0].sheet}'!${specificDayConfig[0].breakRange}`,
                          Option.liftPredicate(
                            () =>
                              !String.Equivalence(
                                specificDayConfig[0].breakRange,
                                "detect",
                              ),
                          ),
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
  static ofGuild = (guildId: string) =>
    pipe(
      GuildConfigService.getGuildConfigByGuildId(guildId),
      Computed.flatMap(Option.flatMap((guildConfig) => guildConfig.sheetId)),
      Computed.map((sheetId) =>
        SheetService.DefaultWithoutDependencies(sheetId),
      ),
    );
}
