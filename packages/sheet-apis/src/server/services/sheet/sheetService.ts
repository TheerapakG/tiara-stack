import { GoogleSheets } from "@/google/sheets";
import {
  HourRange,
  RawPlayer,
  Schedule,
  ScheduleConfig,
  ScheduleIndex,
  Team,
  TeamConfig,
} from "@/server/schema";
import { type MethodOptions, type sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Data,
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
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";
import { GuildConfigService } from "../guildConfigService";
import { RunnerConfigMap, SheetConfigService } from "../sheetConfigService";

const playerParser = ([
  userIds,
  userSheetNames,
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<
  RawPlayer[],
  never,
  GoogleSheets
> =>
  pipe(
    Effect.Do,
    Effect.bindAll(
      () => ({
        userIds: pipe(
          GoogleSheets.parseValueRangeToStringOption(userIds),
          Effect.map(
            Array.map((id, index) => ({
              id,
              idIndex: index,
            })),
          ),
          Effect.map(
            ArrayUtils.WithDefault.wrap({
              default: {
                id: Option.none<string>(),
                idIndex: globalThis.Number.NaN,
              },
            }),
          ),
        ),
        userSheetNames: pipe(
          GoogleSheets.parseValueRangeToStringOption(userSheetNames),
          Effect.map(
            Array.map((name, index) => ({
              name,
              nameIndex: index,
            })),
          ),
          Effect.map(
            ArrayUtils.WithDefault.wrap({
              default: {
                name: Option.none<string>(),
                nameIndex: globalThis.Number.NaN,
              },
            }),
          ),
        ),
      }),
      { concurrency: "unbounded" },
    ),
    Effect.map(({ userIds, userSheetNames }) =>
      pipe(userIds, ArrayUtils.WithDefault.zip(userSheetNames)),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.map((value) => new RawPlayer(value)),
      ),
    ),
    Effect.withSpan("playerParser", { captureStackTrace: true }),
  );

class TeamConfigField extends Data.TaggedClass("TeamConfigField")<{
  name: string;
  field: string;
}> {}

const teamRanges = (teamConfigValues: TeamConfig[]) =>
  pipe(
    teamConfigValues,
    Array.reduce(
      HashMap.empty<TeamConfigField, Option.Option<string>>(),
      (acc, a) =>
        pipe(
          acc,
          HashMap.set(
            new TeamConfigField({
              name: a.name,
              field: "playerName",
            }),
            Option.some(`'${a.sheet}'!${a.playerNameRange}`),
          ),
          HashMap.set(
            new TeamConfigField({
              name: a.name,
              field: "teamName",
            }),
            Option.some(`'${a.sheet}'!${a.teamNameRange}`),
          ),
          HashMap.set(
            new TeamConfigField({ name: a.name, field: "lead" }),
            Option.some(`'${a.sheet}'!${a.leadRange}`),
          ),
          HashMap.set(
            new TeamConfigField({
              name: a.name,
              field: "backline",
            }),
            Option.some(`'${a.sheet}'!${a.backlineRange}`),
          ),
          HashMap.set(
            new TeamConfigField({
              name: a.name,
              field: "talent",
            }),
            Option.some(`'${a.sheet}'!${a.talentRange}`),
          ),
          HashMap.set(
            new TeamConfigField({ name: a.name, field: "tags" }),
            pipe(
              Match.value(a.tagsConfig),
              Match.tag("TeamTagsRangesConfig", (tagsConfig) =>
                Option.some(`'${a.sheet}'!${tagsConfig.tagsRange}`),
              ),
              Match.orElse(() => Option.none()),
            ),
          ),
        ),
    ),
    HashMap.filterMap((a, _) => a),
  );

const teamParser = (
  teamConfigValues: TeamConfig[],
  sheet: HashMap.HashMap<TeamConfigField, sheets_v4.Schema$ValueRange>,
) =>
  pipe(
    teamConfigValues,
    Effect.forEach((teamConfig) =>
      pipe(
        Effect.Do,
        Effect.bindAll(
          () => ({
            playerName: pipe(
              sheet,
              HashMap.get(
                new TeamConfigField({
                  name: teamConfig.name,
                  field: "playerName",
                }),
              ),
              Effect.flatMap((playerName) =>
                GoogleSheets.parseValueRangeToStringOption(playerName),
              ),
              Effect.map(Array.map((playerName) => ({ playerName }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: { playerName: Option.none<string>() },
                }),
              ),
            ),
            teamName: pipe(
              sheet,
              HashMap.get(
                new TeamConfigField({
                  name: teamConfig.name,
                  field: "teamName",
                }),
              ),
              Effect.flatMap((teamName) =>
                GoogleSheets.parseValueRangeToStringOption(teamName),
              ),
              Effect.map(Array.map((teamName) => ({ teamName }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: { teamName: Option.none<string>() },
                }),
              ),
            ),
            lead: pipe(
              sheet,
              HashMap.get(
                new TeamConfigField({ name: teamConfig.name, field: "lead" }),
              ),
              Effect.flatMap((lead) =>
                GoogleSheets.parseValueRangeToNumberOption(lead),
              ),
              Effect.map(Array.map((lead) => ({ lead }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: { lead: Option.none<number>() },
                }),
              ),
            ),
            backline: pipe(
              sheet,
              HashMap.get(
                new TeamConfigField({
                  name: teamConfig.name,
                  field: "backline",
                }),
              ),
              Effect.flatMap((backline) =>
                GoogleSheets.parseValueRangeToNumberOption(backline),
              ),
              Effect.map(Array.map((backline) => ({ backline }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: { backline: Option.none<number>() },
                }),
              ),
            ),
            talent: pipe(
              sheet,
              HashMap.get(
                new TeamConfigField({ name: teamConfig.name, field: "talent" }),
              ),
              Effect.flatMap((talent) =>
                pipe(GoogleSheets.parseValueRangeToNumberOption(talent)),
              ),
              Effect.map(Array.map((talent) => ({ talent }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: { talent: Option.none<number>() },
                }),
              ),
            ),
            tags: pipe(
              Match.value(teamConfig.tagsConfig),
              Match.tagsExhaustive({
                TeamTagsConstantsConfig: (teamConfig) =>
                  pipe(
                    Effect.succeed<{ tags: readonly string[] }[]>([]),
                    Effect.map(
                      ArrayUtils.WithDefault.wrap({
                        default: { tags: teamConfig.tags },
                      }),
                    ),
                  ),
                TeamTagsRangesConfig: () =>
                  pipe(
                    sheet,
                    HashMap.get(
                      new TeamConfigField({
                        name: teamConfig.name,
                        field: "tags",
                      }),
                    ),
                    Effect.flatMap((tags) =>
                      GoogleSheets.parseValueRangeFromStringListToStringArray(
                        tags,
                      ),
                    ),
                    Effect.map(Array.map((tags) => ({ tags }))),
                    Effect.map(
                      ArrayUtils.WithDefault.wrap({
                        default: { tags: [] },
                      }),
                    ),
                  ),
              }),
            ),
          }),
          { concurrency: "unbounded" },
        ),
        Effect.map(({ playerName, teamName, lead, backline, talent, tags }) =>
          pipe(
            playerName,
            ArrayUtils.WithDefault.zip(teamName),
            ArrayUtils.WithDefault.zip(lead),
            ArrayUtils.WithDefault.zip(backline),
            ArrayUtils.WithDefault.zip(talent),
            ArrayUtils.WithDefault.zip(tags),
            ArrayUtils.WithDefault.toArray,
            Array.map(
              ({ playerName, teamName, lead, backline, talent, tags }) =>
                pipe(
                  Option.Do,
                  Option.bind("playerName", () => playerName),
                  Option.bind("teamName", () => teamName),
                  Option.let("lead", () => lead),
                  Option.let("backline", () => backline),
                  Option.let("talent", () => talent),
                  Option.let("tags", () => tags),
                  Option.map(
                    ({
                      playerName,
                      teamName,
                      lead,
                      backline,
                      talent,
                      tags,
                    }) => ({
                      name: playerName,
                      team: new Team({
                        type: teamConfig.name,
                        name: teamName,
                        tags,
                        lead,
                        backline,
                        talent,
                      }),
                    }),
                  ),
                ),
            ),
            Array.getSomes,
          ),
        ),
      ),
    ),
    Effect.map(Array.flatten),
    Effect.map(
      ArrayUtils.Collect.toHashMap({
        keyGetter: ({ name }) => name,
        valueInitializer: ({ name, team }) => ({ name, teams: [team] }),
        valueReducer: ({ name, teams }, { team }) => ({
          name,
          teams: Array.append(teams, team),
        }),
      }),
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

export type ScheduleMap = HashMap.HashMap<
  ScheduleIndex,
  HashMap.HashMap<number, Schedule>
>;

class ScheduleConfigField extends Data.TaggedClass("ScheduleConfigField")<{
  channel: string;
  day: number;
  field: string;
}> {}

const scheduleConfigFields = [
  "channel",
  "day",
  "sheet",
  "hourRange",
  "breakRange",
  "monitorRange",
  "fillRange",
  "overfillRange",
  "standbyRange",
] as const;

type FilteredScheduleConfigValue = Option.Option.Value<
  Utils.GetSomeFields<ScheduleConfig, (typeof scheduleConfigFields)[number]>
>;
const filterScheduleConfigValues = (scheduleConfigValues: ScheduleConfig[]) =>
  pipe(
    scheduleConfigValues,
    Array.map(Utils.getSomeFields(scheduleConfigFields)),
    Array.getSomes,
  );

const scheduleRanges = (scheduleConfigValues: FilteredScheduleConfigValue[]) =>
  pipe(
    scheduleConfigValues,
    Array.reduce(
      HashMap.empty<ScheduleConfigField, Option.Option<string>>(),
      (acc, a) =>
        pipe(
          acc,
          HashMap.set(
            new ScheduleConfigField({
              channel: a.channel,
              day: a.day,
              field: "hours",
            }),
            Option.some(`'${a.sheet}'!${a.hourRange}`),
          ),
          HashMap.set(
            new ScheduleConfigField({
              channel: a.channel,
              day: a.day,
              field: "fills",
            }),
            Option.some(`'${a.sheet}'!${a.fillRange}`),
          ),
          HashMap.set(
            new ScheduleConfigField({
              channel: a.channel,
              day: a.day,
              field: "overfills",
            }),
            Option.some(`'${a.sheet}'!${a.overfillRange}`),
          ),
          HashMap.set(
            new ScheduleConfigField({
              channel: a.channel,
              day: a.day,
              field: "standbys",
            }),
            Option.some(`'${a.sheet}'!${a.standbyRange}`),
          ),
          HashMap.set(
            new ScheduleConfigField({
              channel: a.channel,
              day: a.day,
              field: "breaks",
            }),
            pipe(
              Match.value(a.breakRange),
              Match.when("detect", () => Option.none()),
              Match.orElse(() => Option.some(`'${a.sheet}'!${a.breakRange}`)),
            ),
          ),
        ),
    ),
    HashMap.filterMap((a, _) => a),
  );

const scheduleParser = (
  scheduleConfigValues: FilteredScheduleConfigValue[],
  sheet: HashMap.HashMap<ScheduleConfigField, sheets_v4.Schema$ValueRange>,
  runnerConfigMap: RunnerConfigMap,
) =>
  pipe(
    scheduleConfigValues,
    Effect.forEach((scheduleConfig) =>
      pipe(
        Effect.Do,
        Effect.bindAll(
          () => ({
            hours: pipe(
              sheet,
              HashMap.get(
                new ScheduleConfigField({
                  channel: scheduleConfig.channel,
                  day: scheduleConfig.day,
                  field: "hours",
                }),
              ),
              Effect.flatMap((hours) =>
                GoogleSheets.parseValueRangeToNumberOption(hours),
              ),
              Effect.map(Array.map((hour) => ({ hour }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: { hour: Option.none<number>() },
                }),
              ),
            ),
            fills: pipe(
              sheet,
              HashMap.get(
                new ScheduleConfigField({
                  channel: scheduleConfig.channel,
                  day: scheduleConfig.day,
                  field: "fills",
                }),
              ),
              Effect.flatMap((fills) =>
                GoogleSheets.parseValueRangeFromStringOptionArrayToStringOptionArray(
                  fills,
                ),
              ),
              Effect.map(
                Array.map((fills) =>
                  Array.makeBy(5, (i) =>
                    pipe(Array.get(fills, i), Option.flatten),
                  ),
                ),
              ),
              Effect.map(Array.map((fills) => ({ fills }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: {
                    fills: Array.makeBy(5, () => Option.none<string>()),
                  },
                }),
              ),
            ),
            overfills: pipe(
              sheet,
              HashMap.get(
                new ScheduleConfigField({
                  channel: scheduleConfig.channel,
                  day: scheduleConfig.day,
                  field: "overfills",
                }),
              ),
              Effect.flatMap((overfills) =>
                GoogleSheets.parseValueRangeFromStringListToStringArray(
                  overfills,
                ),
              ),
              Effect.map(Array.map((overfills) => ({ overfills }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: { overfills: [] },
                }),
              ),
            ),
            standbys: pipe(
              sheet,
              HashMap.get(
                new ScheduleConfigField({
                  channel: scheduleConfig.channel,
                  day: scheduleConfig.day,
                  field: "standbys",
                }),
              ),
              Effect.flatMap((standbys) =>
                GoogleSheets.parseValueRangeFromStringListToStringArray(
                  standbys,
                ),
              ),
              Effect.map(Array.map((standbys) => ({ standbys }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: { standbys: [] },
                }),
              ),
            ),
            breaks: pipe(
              Match.value(scheduleConfig.breakRange),
              Match.when("detect", () =>
                pipe(
                  Effect.succeed<{ breakHour: boolean }[]>([]),
                  Effect.map(
                    ArrayUtils.WithDefault.wrap({
                      default: { breakHour: false },
                    }),
                  ),
                ),
              ),
              Match.orElse(() =>
                pipe(
                  sheet,
                  HashMap.get(
                    new ScheduleConfigField({
                      channel: scheduleConfig.channel,
                      day: scheduleConfig.day,
                      field: "breaks",
                    }),
                  ),
                  Effect.flatMap((breaks) =>
                    GoogleSheets.parseValueRangeToBooleanOption(breaks),
                  ),
                  Effect.map(Array.map(Option.getOrElse(() => false))),
                  Effect.map(Array.map((breakHour) => ({ breakHour }))),
                  Effect.map(
                    ArrayUtils.WithDefault.wrap({
                      default: { breakHour: false },
                    }),
                  ),
                ),
              ),
            ),
          }),
          { concurrency: "unbounded" },
        ),
        Effect.map(({ hours, fills, overfills, standbys, breaks }) =>
          pipe(
            hours,
            ArrayUtils.WithDefault.zip(fills),
            ArrayUtils.WithDefault.zip(overfills),
            ArrayUtils.WithDefault.zip(standbys),
            ArrayUtils.WithDefault.zip(breaks),
            ArrayUtils.WithDefault.toArray,
            Array.map(({ hour, breakHour, fills, overfills, standbys }) =>
              pipe(
                Option.Do,
                Option.bind("hour", () => hour),
                Option.let("breakHour", () => breakHour),
                Option.let("fills", () => fills),
                Option.let("overfills", () => overfills),
                Option.let("standbys", () => standbys),
                Option.map(({ hour, breakHour, fills, ...config }) =>
                  Schedule.make({
                    ...config,
                    hour,
                    fills,
                    breakHour: pipe(
                      Match.value(scheduleConfig.breakRange),
                      Match.when("detect", () =>
                        pipe(
                          fills,
                          Array.getSomes,
                          Array.map((fill) =>
                            pipe(runnerConfigMap, HashMap.get(fill)),
                          ),
                          Array.getSomes,
                          Array.filter((config) =>
                            pipe(
                              config.hours,
                              Array.some(HourRange.includes(hour)),
                            ),
                          ),
                          Array.isEmptyArray,
                        ),
                      ),
                      Match.orElse(() => breakHour),
                    ),
                  }),
                ),
                Option.map(Schedule.toEmptyIfBreak),
              ),
            ),
            Array.getSomes,
          ),
        ),
        Effect.map((array) =>
          pipe({
            scheduleIndex: new ScheduleIndex({
              channel: scheduleConfig.channel,
              day: scheduleConfig.day,
            }),
            schedules: pipe(
              array,
              ArrayUtils.Collect.toHashMap({
                keyGetter: ({ hour }) => hour,
                valueInitializer: (a) => a,
                valueReducer: (_, a) => a,
              }),
            ),
          }),
        ),
      ),
    ),
    Effect.map((array) =>
      pipe(
        array,
        ArrayUtils.Collect.toHashMap({
          keyGetter: ({ scheduleIndex }) => scheduleIndex,
          valueInitializer: ({ schedules }) => schedules,
          valueReducer: (acc, { schedules }) => HashMap.union(acc, schedules),
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
        Effect.bindAll(
          () => ({
            sheet: GoogleSheets,
            sheetConfigService: SheetConfigService,
          }),
          { concurrency: "unbounded" },
        ),
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
            scheduleConfig: Effect.cached(
              pipe(
                sheetConfigService.getScheduleConfig(sheetId),
                Effect.withSpan("SheetService.scheduleConfig", {
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
              params?: Omit<
                sheets_v4.Params$Resource$Spreadsheets$Values$Batchget,
                "spreadsheetId"
              >,
              options?: MethodOptions,
            ) =>
              pipe(
                sheet.getHashMap(
                  ranges,
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
        Effect.let(
          "sheetGetSheetGids",
          ({ sheet }) =>
            () =>
              pipe(
                sheet.getSheetGids(sheetId),
                Effect.withSpan("SheetService.getSheetGids", {
                  captureStackTrace: true,
                }),
              ),
        ),
        Effect.bindAll(
          ({
            sheet,
            sheetGet,
            sheetGetHashMap,
            rangesConfig,
            scheduleConfig,
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
              Effect.provideService(GoogleSheets, sheet),
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
                teamRanges(teamConfigValues),
              ),
              Effect.bind("sheet", ({ ranges }) => sheetGetHashMap(ranges)),
              Effect.flatMap(({ teamConfigValues, sheet }) =>
                teamParser(teamConfigValues, sheet),
              ),
              Effect.provideService(GoogleSheets, sheet),
              Effect.withSpan("SheetService.teams", {
                captureStackTrace: true,
              }),
              Effect.cached,
            ),
            allSchedules: pipe(
              Effect.Do,
              Effect.bindAll(
                () => ({
                  scheduleConfigs: scheduleConfig,
                  runnerConfig,
                }),
                { concurrency: "unbounded" },
              ),
              Effect.let("filteredScheduleConfigs", ({ scheduleConfigs }) =>
                filterScheduleConfigValues(scheduleConfigs),
              ),
              Effect.bind("sheet", ({ filteredScheduleConfigs }) =>
                sheetGetHashMap(scheduleRanges(filteredScheduleConfigs)),
              ),
              Effect.bind(
                "schedules",
                ({ filteredScheduleConfigs, sheet, runnerConfig }) =>
                  scheduleParser(filteredScheduleConfigs, sheet, runnerConfig),
              ),
              Effect.map(({ schedules }) => schedules),
              Effect.provideService(GoogleSheets, sheet),
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
            sheet,
            sheetGet,
            sheetGetHashMap,
            sheetUpdate,
            sheetGetSheetGids,
            rangesConfig,
            teamConfig,
            eventConfig,
            scheduleConfig,
            players,
            teams,
            allSchedules,
            runnerConfig,
          }) => ({
            sheetId: sheetId,
            get: sheetGet,
            getHashMap: () => sheetGetHashMap,
            update: sheetUpdate,
            getSheetGids: sheetGetSheetGids,
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
            getScheduleConfig: () =>
              pipe(
                scheduleConfig,
                Effect.withSpan("SheetService.getScheduleConfig", {
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
                Effect.bindAll(
                  () => ({
                    scheduleConfigs: scheduleConfig,
                    runnerConfig,
                  }),
                  { concurrency: "unbounded" },
                ),
                Effect.let("filteredScheduleConfigs", ({ scheduleConfigs }) =>
                  pipe(
                    scheduleConfigs,
                    filterScheduleConfigValues,
                    Array.filter((a) => Number.Equivalence(a.day, day)),
                  ),
                ),
                Effect.bind("sheet", ({ filteredScheduleConfigs }) =>
                  sheetGetHashMap(scheduleRanges(filteredScheduleConfigs)),
                ),
                Effect.bind(
                  "schedules",
                  ({ filteredScheduleConfigs, sheet, runnerConfig }) =>
                    scheduleParser(
                      filteredScheduleConfigs,
                      sheet,
                      runnerConfig,
                    ),
                ),
                Effect.map(({ schedules }) => schedules),
                Effect.provideService(GoogleSheets, sheet),
                Effect.withSpan("SheetService.daySchedules", {
                  captureStackTrace: true,
                }),
              ),
            getChannelSchedules: (channel: string) =>
              pipe(
                Effect.Do,
                Effect.bindAll(
                  () => ({
                    scheduleConfigs: scheduleConfig,
                    runnerConfig,
                  }),
                  { concurrency: "unbounded" },
                ),
                Effect.let("filteredScheduleConfigs", ({ scheduleConfigs }) =>
                  pipe(
                    scheduleConfigs,
                    filterScheduleConfigValues,
                    Array.filter((a) => String.Equivalence(a.channel, channel)),
                  ),
                ),
                Effect.bind("sheet", ({ filteredScheduleConfigs }) =>
                  sheetGetHashMap(scheduleRanges(filteredScheduleConfigs)),
                ),
                Effect.bind(
                  "schedules",
                  ({ filteredScheduleConfigs, sheet, runnerConfig }) =>
                    scheduleParser(
                      filteredScheduleConfigs,
                      sheet,
                      runnerConfig,
                    ),
                ),
                Effect.map(({ schedules }) => schedules),
                Effect.provideService(GoogleSheets, sheet),
                Effect.withSpan("SheetService.channelSchedules", {
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
