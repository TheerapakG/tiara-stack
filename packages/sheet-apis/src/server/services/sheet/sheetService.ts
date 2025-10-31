import { GoogleSheets } from "@/google/sheets";
import {
  Error,
  HourRange,
  RunnerConfig,
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
  Either,
  HashMap,
  Match,
  Number,
  Option,
  Order,
  pipe,
  Schema,
  String,
} from "effect";
import { Computed } from "typhoon-core/signal";
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";
import { GuildConfigService } from "../guildConfigService";
import { SheetConfigService } from "../sheetConfigService";

class ConfigField<Range> extends Data.TaggedClass("ConfigField")<{
  range: Range;
  field: string;
}> {}

const getConfigFieldValueRange =
  <Range>(configField: ConfigField<Range>) =>
  (sheet: HashMap.HashMap<ConfigField<Range>, sheets_v4.Schema$ValueRange>) =>
    pipe(
      sheet,
      HashMap.get(configField),
      Option.match({
        onSome: Effect.succeed,
        onNone: () =>
          Effect.fail(
            new Error.ParserFieldError({
              message: `Error getting ${configField.field}, no config field found`,
              range: configField.range,
              field: configField.field,
            }),
          ),
      }),
      (e) => Effect.suspend(() => e),
      Effect.withSpan("getConfigFieldValueRange", { captureStackTrace: true }),
    );

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
          GoogleSheets.parseValueRange(
            userIds,
            pipe(
              GoogleSheets.rowToCellSchema,
              Schema.compose(GoogleSheets.cellToStringSchema),
            ),
          ),
          Effect.map(Array.map(Either.getOrElse(Option.none<string>))),
          Effect.map(
            Array.map((id, index) => ({
              id,
              idIndex: index,
            })),
          ),
          Effect.map(
            ArrayUtils.WithDefault.wrap({
              default: () => ({
                id: Option.none<string>(),
                idIndex: globalThis.Number.NaN,
              }),
            }),
          ),
        ),
        userSheetNames: pipe(
          GoogleSheets.parseValueRange(
            userSheetNames,
            pipe(
              GoogleSheets.rowToCellSchema,
              Schema.compose(GoogleSheets.cellToStringSchema),
            ),
          ),
          Effect.map(Array.map(Either.getOrElse(Option.none<string>))),
          Effect.map(
            Array.map((name, index) => ({
              name,
              nameIndex: index,
            })),
          ),
          Effect.map(
            ArrayUtils.WithDefault.wrap({
              default: () => ({
                name: Option.none<string>(),
                nameIndex: globalThis.Number.NaN,
              }),
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

class TeamConfigRange extends Data.TaggedClass("TeamConfigRange")<{
  name: string;
}> {}
class TeamConfigField extends ConfigField<TeamConfigRange> {}

const teamConfigFields = [
  "name",
  "sheet",
  "playerNameRange",
  "teamNameRange",
  "leadRange",
  "backlineRange",
  "talentRange",
  "tagsConfig",
] as const;

type FilteredTeamConfigValue = Option.Option.Value<
  Utils.GetSomeFields<TeamConfig, (typeof teamConfigFields)[number]>
>;
const filterTeamConfigValues = (teamConfigValues: TeamConfig[]) =>
  pipe(
    teamConfigValues,
    Array.map(Utils.getSomeFields(teamConfigFields)),
    Array.getSomes,
  );

const makeTeamConfigField = (
  teamConfigValue: FilteredTeamConfigValue,
  field: string,
) =>
  new TeamConfigField({
    range: new TeamConfigRange({ name: teamConfigValue.name }),
    field,
  });

const teamRange = (teamConfigValue: FilteredTeamConfigValue) => ({
  playerName: {
    field: makeTeamConfigField(teamConfigValue, "playerName"),
    range: Option.some(
      `'${teamConfigValue.sheet}'!${teamConfigValue.playerNameRange}`,
    ),
  },
  teamName: {
    field: makeTeamConfigField(teamConfigValue, "teamName"),
    range: Option.some(
      `'${teamConfigValue.sheet}'!${teamConfigValue.teamNameRange}`,
    ),
  },
  lead: {
    field: makeTeamConfigField(teamConfigValue, "lead"),
    range: Option.some(
      `'${teamConfigValue.sheet}'!${teamConfigValue.leadRange}`,
    ),
  },
  backline: {
    field: makeTeamConfigField(teamConfigValue, "backline"),
    range: Option.some(
      `'${teamConfigValue.sheet}'!${teamConfigValue.backlineRange}`,
    ),
  },
  talent: {
    field: makeTeamConfigField(teamConfigValue, "talent"),
    range: Option.some(
      `'${teamConfigValue.sheet}'!${teamConfigValue.talentRange}`,
    ),
  },
  tags: {
    field: makeTeamConfigField(teamConfigValue, "tags"),
    range: pipe(
      Match.value(teamConfigValue.tagsConfig),
      Match.tag("TeamTagsRangesConfig", (tagsConfig) =>
        Option.some(`'${teamConfigValue.sheet}'!${tagsConfig.tagsRange}`),
      ),
      Match.orElse(() => Option.none()),
    ),
  },
});

const teamRanges = (teamConfigValues: FilteredTeamConfigValue[]) =>
  pipe(
    teamConfigValues,
    Array.reduce(
      HashMap.empty<TeamConfigField, Option.Option<string>>(),
      (acc, a) => {
        const range = teamRange(a);
        return pipe(
          acc,
          HashMap.set(range.playerName.field, range.playerName.range),
          HashMap.set(range.teamName.field, range.teamName.range),
          HashMap.set(range.lead.field, range.lead.range),
          HashMap.set(range.backline.field, range.backline.range),
          HashMap.set(range.talent.field, range.talent.range),
          HashMap.set(range.tags.field, range.tags.range),
        );
      },
    ),
    HashMap.filterMap((a, _) => a),
  );

const teamParser = (
  teamConfigValues: FilteredTeamConfigValue[],
  sheet: HashMap.HashMap<TeamConfigField, sheets_v4.Schema$ValueRange>,
) =>
  pipe(
    teamConfigValues,
    Effect.forEach((teamConfig) =>
      pipe(
        Effect.Do,
        Effect.let("range", () => teamRange(teamConfig)),
        Effect.bindAll(
          ({ range }) => ({
            playerName: pipe(
              sheet,
              getConfigFieldValueRange(range.playerName.field),
              Effect.flatMap((playerName) =>
                GoogleSheets.parseValueRange(
                  playerName,
                  pipe(
                    GoogleSheets.rowToCellSchema,
                    Schema.compose(GoogleSheets.cellToStringSchema),
                  ),
                ),
              ),
              Effect.map(Array.map(Either.getOrElse(Option.none<string>))),
              Effect.map(Array.map((playerName) => ({ playerName }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: () => ({ playerName: Option.none<string>() }),
                }),
              ),
            ),
            teamName: pipe(
              sheet,
              getConfigFieldValueRange(range.teamName.field),
              Effect.flatMap((teamName) =>
                GoogleSheets.parseValueRange(
                  teamName,
                  pipe(
                    GoogleSheets.rowToCellSchema,
                    Schema.compose(GoogleSheets.cellToStringSchema),
                  ),
                ),
              ),
              Effect.map(Array.map(Either.getOrElse(Option.none<string>))),
              Effect.map(Array.map((teamName) => ({ teamName }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: () => ({ teamName: Option.none<string>() }),
                }),
              ),
            ),
            lead: pipe(
              sheet,
              getConfigFieldValueRange(range.lead.field),
              Effect.flatMap((lead) =>
                GoogleSheets.parseValueRange(
                  lead,
                  pipe(
                    GoogleSheets.rowToCellSchema,
                    Schema.compose(GoogleSheets.cellToNumberSchema),
                  ),
                ),
              ),
              Effect.map(Array.map(Either.getOrElse(Option.none<number>))),
              Effect.map(Array.map((lead) => ({ lead }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: () => ({ lead: Option.none<number>() }),
                }),
              ),
            ),
            backline: pipe(
              sheet,
              getConfigFieldValueRange(range.backline.field),
              Effect.flatMap((backline) =>
                GoogleSheets.parseValueRange(
                  backline,
                  pipe(
                    GoogleSheets.rowToCellSchema,
                    Schema.compose(GoogleSheets.cellToNumberSchema),
                  ),
                ),
              ),
              Effect.map(Array.map(Either.getOrElse(Option.none<number>))),
              Effect.map(Array.map((backline) => ({ backline }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: () => ({ backline: Option.none<number>() }),
                }),
              ),
            ),
            talent: pipe(
              sheet,
              getConfigFieldValueRange(range.talent.field),
              Effect.flatMap((talent) =>
                GoogleSheets.parseValueRange(
                  talent,
                  pipe(
                    GoogleSheets.rowToCellSchema,
                    Schema.compose(GoogleSheets.cellToNumberSchema),
                  ),
                ),
              ),
              Effect.map(Array.map(Either.getOrElse(Option.none<number>))),
              Effect.map(Array.map((talent) => ({ talent }))),
              Effect.map(
                ArrayUtils.WithDefault.wrap({
                  default: () => ({ talent: Option.none<number>() }),
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
                        default: () => ({ tags: teamConfig.tags }),
                      }),
                    ),
                  ),
                TeamTagsRangesConfig: () =>
                  pipe(
                    sheet,
                    getConfigFieldValueRange(range.tags.field),
                    Effect.flatMap((tags) =>
                      GoogleSheets.parseValueRange(
                        tags,
                        pipe(
                          GoogleSheets.rowToCellSchema,
                          Schema.compose(GoogleSheets.cellToStringArraySchema),
                        ),
                      ),
                    ),
                    Effect.map(
                      Array.map(Either.getOrElse(Option.none<string[]>)),
                    ),
                    Effect.map(Array.map(Option.getOrElse(() => []))),
                    Effect.map(Array.map((tags) => ({ tags }))),
                    Effect.map(
                      ArrayUtils.WithDefault.wrap({
                        default: () => ({ tags: [] }),
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
    Effect.map(ArrayUtils.Collect.toArrayHashMapByKey("name")),
    Effect.map(
      HashMap.map((teams, name) => ({
        name,
        teams: pipe(
          teams,
          Array.map(({ team }) => team),
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

class ScheduleConfigRange extends Data.TaggedClass("ScheduleConfigRange")<{
  channel: string;
  day: number;
}> {}
class ScheduleConfigField extends ConfigField<ScheduleConfigRange> {}

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

const makeScheduleConfigField = (
  scheduleConfigValue: FilteredScheduleConfigValue,
  field: string,
) =>
  new ScheduleConfigField({
    range: new ScheduleConfigRange({
      channel: scheduleConfigValue.channel,
      day: scheduleConfigValue.day,
    }),
    field,
  });

const scheduleRange = (scheduleConfigValue: FilteredScheduleConfigValue) => ({
  hours: {
    field: makeScheduleConfigField(scheduleConfigValue, "hours"),
    range: Option.some(
      `'${scheduleConfigValue.sheet}'!${scheduleConfigValue.hourRange}`,
    ),
  },
  fills: {
    field: makeScheduleConfigField(scheduleConfigValue, "fills"),
    range: Option.some(
      `'${scheduleConfigValue.sheet}'!${scheduleConfigValue.fillRange}`,
    ),
  },
  overfills: {
    field: makeScheduleConfigField(scheduleConfigValue, "overfills"),
    range: Option.some(
      `'${scheduleConfigValue.sheet}'!${scheduleConfigValue.overfillRange}`,
    ),
  },
  standbys: {
    field: makeScheduleConfigField(scheduleConfigValue, "standbys"),
    range: Option.some(
      `'${scheduleConfigValue.sheet}'!${scheduleConfigValue.standbyRange}`,
    ),
  },
  breaks: {
    field: makeScheduleConfigField(scheduleConfigValue, "breaks"),
    range: pipe(
      Match.value(scheduleConfigValue.breakRange),
      Match.when("detect", () => Option.none()),
      Match.orElse(() =>
        Option.some(
          `'${scheduleConfigValue.sheet}'!${scheduleConfigValue.breakRange}`,
        ),
      ),
    ),
  },
});

const scheduleRanges = (scheduleConfigValues: FilteredScheduleConfigValue[]) =>
  pipe(
    scheduleConfigValues,
    Array.reduce(
      HashMap.empty<ScheduleConfigField, Option.Option<string>>(),
      (acc, a) => {
        const range = scheduleRange(a);
        return pipe(
          acc,
          HashMap.set(range.hours.field, range.hours.range),
          HashMap.set(range.fills.field, range.fills.range),
          HashMap.set(range.overfills.field, range.overfills.range),
          HashMap.set(range.standbys.field, range.standbys.range),
          HashMap.set(range.breaks.field, range.breaks.range),
        );
      },
    ),
    HashMap.filterMap((a, _) => a),
  );

const scheduleParser = (
  scheduleConfigValues: FilteredScheduleConfigValue[],
  sheet: HashMap.HashMap<ScheduleConfigField, sheets_v4.Schema$ValueRange>,
  runnerConfigs: RunnerConfig[],
) =>
  pipe(
    Effect.Do,
    Effect.let("runnerConfigMap", () =>
      pipe(runnerConfigs, ArrayUtils.Collect.toHashMapByKey("name")),
    ),
    Effect.flatMap(({ runnerConfigMap }) =>
      Effect.forEach(scheduleConfigValues, (scheduleConfig) =>
        pipe(
          Effect.Do,
          Effect.let("range", () => scheduleRange(scheduleConfig)),
          Effect.bindAll(
            ({ range }) => ({
              hours: pipe(
                sheet,
                getConfigFieldValueRange(range.hours.field),
                Effect.flatMap((hours) =>
                  GoogleSheets.parseValueRange(
                    hours,
                    pipe(
                      GoogleSheets.rowToCellSchema,
                      Schema.compose(GoogleSheets.cellToNumberSchema),
                    ),
                  ),
                ),
                Effect.map(Array.map(Either.getOrElse(Option.none<number>))),
                Effect.map(Array.map((hour) => ({ hour }))),
                Effect.map(
                  ArrayUtils.WithDefault.wrap({
                    default: () => ({ hour: Option.none<number>() }),
                  }),
                ),
              ),
              fills: pipe(
                sheet,
                getConfigFieldValueRange(range.fills.field),
                Effect.flatMap((fills) =>
                  GoogleSheets.parseValueRange(fills, GoogleSheets.rowSchema),
                ),
                Effect.map(Array.map(Either.getOrElse(() => []))),
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
                    default: () => ({
                      fills: Array.makeBy(5, () => Option.none<string>()),
                    }),
                  }),
                ),
              ),
              overfills: pipe(
                sheet,
                getConfigFieldValueRange(range.overfills.field),
                Effect.flatMap((overfills) =>
                  GoogleSheets.parseValueRange(
                    overfills,
                    pipe(
                      GoogleSheets.rowToCellSchema,
                      Schema.compose(GoogleSheets.cellToStringArraySchema),
                    ),
                  ),
                ),
                Effect.map(Array.map(Either.getOrElse(Option.none<string[]>))),
                Effect.map(Array.map(Option.getOrElse(() => []))),
                Effect.map(Array.map((overfills) => ({ overfills }))),
                Effect.map(
                  ArrayUtils.WithDefault.wrap({
                    default: () => ({ overfills: [] }),
                  }),
                ),
              ),
              standbys: pipe(
                sheet,
                getConfigFieldValueRange(range.standbys.field),
                Effect.flatMap((standbys) =>
                  GoogleSheets.parseValueRange(
                    standbys,
                    pipe(
                      GoogleSheets.rowToCellSchema,
                      Schema.compose(GoogleSheets.cellToStringArraySchema),
                    ),
                  ),
                ),
                Effect.map(Array.map(Either.getOrElse(Option.none<string[]>))),
                Effect.map(Array.map(Option.getOrElse(() => []))),
                Effect.map(Array.map((standbys) => ({ standbys }))),
                Effect.map(
                  ArrayUtils.WithDefault.wrap({
                    default: () => ({ standbys: [] }),
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
                        default: () => ({ breakHour: false }),
                      }),
                    ),
                  ),
                ),
                Match.orElse(() =>
                  pipe(
                    sheet,
                    getConfigFieldValueRange(range.breaks.field),
                    Effect.flatMap((breaks) =>
                      GoogleSheets.parseValueRange(
                        breaks,
                        pipe(
                          GoogleSheets.rowToCellSchema,
                          Schema.compose(GoogleSheets.cellToBooleanSchema),
                        ),
                      ),
                    ),
                    Effect.map(
                      Array.map(Either.getOrElse(Option.none<boolean>)),
                    ),
                    Effect.map(Array.map(Option.getOrElse(() => false))),
                    Effect.map(Array.map((breakHour) => ({ breakHour }))),
                    Effect.map(
                      ArrayUtils.WithDefault.wrap({
                        default: () => ({ breakHour: false }),
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
                              pipe(
                                runnerConfigMap,
                                HashMap.get(Option.some(fill)),
                              ),
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
              schedules: pipe(array, ArrayUtils.Collect.toHashMapByKey("hour")),
            }),
          ),
        ),
      ),
    ),
    Effect.map((array) =>
      pipe(
        array,
        ArrayUtils.Collect.toHashMapByKeyWith({
          key: "scheduleIndex",
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
              Effect.bind("teamConfigs", () => teamConfig),
              Effect.let("filteredTeamConfigValues", ({ teamConfigs }) =>
                filterTeamConfigValues(teamConfigs),
              ),
              Effect.let("ranges", ({ filteredTeamConfigValues }) =>
                teamRanges(filteredTeamConfigValues),
              ),
              Effect.bind("sheet", ({ ranges }) => sheetGetHashMap(ranges)),
              Effect.flatMap(({ filteredTeamConfigValues, sheet }) =>
                teamParser(filteredTeamConfigValues, sheet),
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
