import { GoogleSheets } from "@/google/sheets";
import {
  Error,
  HourRange,
  RunnerConfig,
  RawPlayer,
  ScheduleConfig,
  RawSchedulePlayer,
  Team,
  TeamConfig,
  TeamIsvSplitConfig,
  TeamIsvCombinedConfig,
  makeSchedule,
  TeamTagsRangesConfig,
} from "@/server/schema";
import { regex } from "arkregex";
import { type MethodOptions, type sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Data,
  Effect,
  HashMap,
  Match,
  Number,
  Option,
  pipe,
  Schema,
  String,
} from "effect";
import { Result, TupleToStructValueSchema } from "typhoon-core/schema";
import { Computed } from "typhoon-core/signal";
import { Array as ArrayUtils, Struct as StructUtils } from "typhoon-core/utils";
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
]: sheets_v4.Schema$ValueRange[]) =>
  pipe(
    GoogleSheets.parseValueRanges(
      [userIds, userSheetNames],
      pipe(
        TupleToStructValueSchema(["id", "name"], GoogleSheets.rowToCellSchema),
        Schema.compose(
          Schema.Struct({
            id: GoogleSheets.cellToStringSchema,
            name: GoogleSheets.cellToStringSchema,
          }),
        ),
      ),
    ),
    Effect.map(Array.getRights),
    Effect.map(
      Array.map((config, index) => new RawPlayer({ index, ...config })),
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
  "isvConfig",
  "tagsConfig",
] as const;

type FilteredTeamConfigValue = Option.Option.Value<
  StructUtils.GetSomeFields.GetSomeFields<
    TeamConfig,
    (typeof teamConfigFields)[number]
  >
>;
const filterTeamConfigValues = (teamConfigValues: TeamConfig[]) =>
  pipe(
    teamConfigValues,
    Array.map(StructUtils.GetSomeFields.getSomeFields(teamConfigFields)),
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

const teamBaseRange = (teamConfigValue: FilteredTeamConfigValue) =>
  ({
    playerName: {
      field: makeTeamConfigField(teamConfigValue, "playerName"),
      range: Option.some(
        `'${teamConfigValue.sheet}'!${teamConfigValue.playerNameRange}`,
      ),
    },
    teamName: {
      field: makeTeamConfigField(teamConfigValue, "teamName"),
      range: pipe(
        Match.value(teamConfigValue.teamNameRange),
        Match.when("auto", () => Option.none()),
        Match.orElse(() =>
          Option.some(
            `'${teamConfigValue.sheet}'!${teamConfigValue.teamNameRange}`,
          ),
        ),
      ),
    },
  }) as const;

const playerNameRegex = regex("^(?<name>.*?)\\s+(?<enc>\\(e(?:nc)?\\))?$");

const teamBaseParser = (
  teamConfigValue: FilteredTeamConfigValue,
  sheet: HashMap.HashMap<TeamConfigField, sheets_v4.Schema$ValueRange>,
) =>
  pipe(
    Effect.Do,
    Effect.let("range", () => teamBaseRange(teamConfigValue)),
    Effect.flatMap(({ range }) =>
      Effect.all(
        [
          pipe(sheet, getConfigFieldValueRange(range.playerName.field)),
          pipe(
            Match.value(teamConfigValue.teamNameRange),
            Match.when("auto", () => Effect.succeed({ values: [] })),
            Match.orElse(() =>
              pipe(sheet, getConfigFieldValueRange(range.teamName.field)),
            ),
          ),
        ],
        { concurrency: "unbounded" },
      ),
    ),
    Effect.flatMap((valueRanges) =>
      GoogleSheets.parseValueRanges(
        valueRanges,
        pipe(
          TupleToStructValueSchema(
            ["playerName", "teamName"],
            GoogleSheets.rowToCellSchema,
          ),
          Schema.compose(
            Schema.Struct({
              playerName: GoogleSheets.cellToStringSchema,
              teamName: GoogleSheets.cellToStringSchema,
            }),
          ),
        ),
      ),
    ),
    Effect.map(
      ArrayUtils.WithDefault.wrapEither({
        default: () => ({
          playerName: Option.none<string>(),
          teamName: Option.none<string>(),
        }),
      }),
    ),
    Effect.map(
      ArrayUtils.WithDefault.map(({ playerName, teamName }) => ({
        playerName: pipe(
          playerName,
          Option.map(
            (name) => playerNameRegex.exec(name)?.groups?.name ?? name,
          ),
        ),
        teamName: pipe(
          Match.value(teamConfigValue.teamNameRange),
          Match.when("auto", () =>
            pipe(
              playerName,
              Option.map((name) => `${name} | ${teamConfigValue.name}`),
            ),
          ),
          Match.orElse(() => teamName),
        ),
      })),
    ),
  );

const teamSplitIsvRange = (
  teamConfigValue: FilteredTeamConfigValue,
  cfg: TeamIsvSplitConfig,
) =>
  ({
    lead: {
      field: makeTeamConfigField(teamConfigValue, "lead"),
      range: Option.some(`'${teamConfigValue.sheet}'!${cfg.leadRange}`),
    },
    backline: {
      field: makeTeamConfigField(teamConfigValue, "backline"),
      range: Option.some(`'${teamConfigValue.sheet}'!${cfg.backlineRange}`),
    },
    talent: {
      field: makeTeamConfigField(teamConfigValue, "talent"),
      range: Option.some(`'${teamConfigValue.sheet}'!${cfg.talentRange}`),
    },
  }) as const;

const teamSplitIsvParser = (
  teamConfigValue: FilteredTeamConfigValue,
  cfg: TeamIsvSplitConfig,
  sheet: HashMap.HashMap<TeamConfigField, sheets_v4.Schema$ValueRange>,
) =>
  pipe(
    Effect.Do,
    Effect.let("range", () => teamSplitIsvRange(teamConfigValue, cfg)),
    Effect.flatMap(({ range }) =>
      Effect.all(
        [
          pipe(sheet, getConfigFieldValueRange(range.lead.field)),
          pipe(sheet, getConfigFieldValueRange(range.backline.field)),
          pipe(sheet, getConfigFieldValueRange(range.talent.field)),
        ],
        { concurrency: "unbounded" },
      ),
    ),
    Effect.flatMap((valueRanges) =>
      GoogleSheets.parseValueRanges(
        valueRanges,
        pipe(
          TupleToStructValueSchema(
            ["lead", "backline", "talent"],
            GoogleSheets.rowToCellSchema,
          ),
          Schema.compose(
            Schema.Struct({
              lead: GoogleSheets.cellToNumberSchema,
              backline: GoogleSheets.cellToNumberSchema,
              talent: GoogleSheets.cellToNumberSchema,
            }),
          ),
        ),
      ),
    ),
    Effect.map(
      ArrayUtils.WithDefault.wrapEither({
        default: () => ({
          lead: Option.none<number>(),
          backline: Option.none<number>(),
          talent: Option.none<number>(),
        }),
      }),
    ),
  );

const teamCombinedIsvRange = (
  teamConfigValue: FilteredTeamConfigValue,
  cfg: TeamIsvCombinedConfig,
) =>
  ({
    isv: {
      field: makeTeamConfigField(teamConfigValue, "isv"),
      range: Option.some(`'${teamConfigValue.sheet}'!${cfg.isvRange}`),
    },
  }) as const;

const teamCombinedIsvParser = (
  teamConfigValue: FilteredTeamConfigValue,
  cfg: TeamIsvCombinedConfig,
  sheet: HashMap.HashMap<TeamConfigField, sheets_v4.Schema$ValueRange>,
) =>
  pipe(
    Effect.Do,
    Effect.let("range", () => teamCombinedIsvRange(teamConfigValue, cfg)),
    Effect.flatMap(({ range }) =>
      Effect.all([pipe(sheet, getConfigFieldValueRange(range.isv.field))], {
        concurrency: "unbounded",
      }),
    ),
    Effect.flatMap((valueRanges) =>
      GoogleSheets.parseValueRanges(
        valueRanges,
        pipe(
          TupleToStructValueSchema(["isv"], GoogleSheets.rowToCellSchema),
          Schema.compose(
            Schema.Struct({
              isv: GoogleSheets.cellToStringSchema,
            }),
          ),
        ),
      ),
    ),
    Effect.map(
      ArrayUtils.WithDefault.wrapEither({
        default: () => ({
          isv: Option.none<string>(),
        }),
      }),
    ),
    Effect.map(
      ArrayUtils.WithDefault.map(({ isv }) =>
        pipe(
          isv,
          Option.map(String.split("/")),
          Option.map(Array.map(String.trim)),
          (isv) => ({
            lead: pipe(isv, Option.flatMap(Array.get(0))),
            backline: pipe(isv, Option.flatMap(Array.get(1))),
            talent: pipe(isv, Option.flatMap(Array.get(2))),
          }),
        ),
      ),
    ),
    Effect.map(ArrayUtils.WithDefault.toArray),
    Effect.flatMap(
      Effect.forEach((isv) =>
        pipe(
          isv,
          Schema.decode(
            Schema.Struct({
              lead: GoogleSheets.cellToNumberSchema,
              backline: GoogleSheets.cellToNumberSchema,
              talent: GoogleSheets.cellToNumberSchema,
            }),
          ),
          Effect.either,
        ),
      ),
    ),
    Effect.map(
      ArrayUtils.WithDefault.wrapEither({
        default: () => ({
          lead: Option.none<number>(),
          backline: Option.none<number>(),
          talent: Option.none<number>(),
        }),
      }),
    ),
  );

const teamRangesTagsRange = (
  teamConfigValue: FilteredTeamConfigValue,
  cfg: TeamTagsRangesConfig,
) =>
  ({
    tags: {
      field: makeTeamConfigField(teamConfigValue, "tags"),
      range: Option.some(`'${teamConfigValue.sheet}'!${cfg.tagsRange}`),
    },
  }) as const;

const teamRangesTagsParser = (
  teamConfigValue: FilteredTeamConfigValue,
  cfg: TeamTagsRangesConfig,
  sheet: HashMap.HashMap<TeamConfigField, sheets_v4.Schema$ValueRange>,
) =>
  pipe(
    Effect.Do,
    Effect.let("range", () => teamRangesTagsRange(teamConfigValue, cfg)),
    Effect.flatMap(({ range }) =>
      Effect.all([pipe(sheet, getConfigFieldValueRange(range.tags.field))], {
        concurrency: "unbounded",
      }),
    ),
    Effect.flatMap((valueRanges) =>
      GoogleSheets.parseValueRanges(
        valueRanges,
        pipe(
          TupleToStructValueSchema(["tags"], GoogleSheets.rowToCellSchema),
          Schema.compose(
            Schema.Struct({
              tags: GoogleSheets.cellToStringArraySchema,
            }),
          ),
        ),
      ),
    ),
    Effect.map(
      ArrayUtils.WithDefault.wrapEither({
        default: () => ({
          tags: Option.none<string[]>(),
        }),
      }),
    ),
    Effect.map(
      ArrayUtils.WithDefault.map(({ tags }) => ({
        tags: pipe(
          tags,
          Option.getOrElse(() => []),
        ),
      })),
    ),
  );

const teamRanges = (teamConfigValues: FilteredTeamConfigValue[]) =>
  pipe(
    teamConfigValues,
    Array.reduce(
      HashMap.empty<TeamConfigField, Option.Option<string>>(),
      (acc, a) => {
        const range = teamBaseRange(a);
        return pipe(
          acc,
          HashMap.set(range.playerName.field, range.playerName.range),
          HashMap.set(range.teamName.field, range.teamName.range),
          (map) =>
            pipe(
              Match.value(a.isvConfig),
              Match.tagsExhaustive({
                TeamIsvSplitConfig: (cfg) => {
                  const range = teamSplitIsvRange(a, cfg);
                  return pipe(
                    map,
                    HashMap.set(range.lead.field, range.lead.range),
                    HashMap.set(range.backline.field, range.backline.range),
                    HashMap.set(range.talent.field, range.talent.range),
                  );
                },
                TeamIsvCombinedConfig: (cfg) => {
                  const range = teamCombinedIsvRange(a, cfg);
                  return pipe(
                    map,
                    HashMap.set(range.isv.field, range.isv.range),
                  );
                },
              }),
            ),
          (map) =>
            pipe(
              Match.value(a.tagsConfig),
              Match.tagsExhaustive({
                TeamTagsConstantsConfig: () => map,
                TeamTagsRangesConfig: (cfg) => {
                  const range = teamRangesTagsRange(a, cfg);
                  return pipe(
                    map,
                    HashMap.set(range.tags.field, range.tags.range),
                  );
                },
              }),
            ),
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
        Effect.all({
          base: teamBaseParser(teamConfig, sheet),
          isv: pipe(
            Match.value(teamConfig.isvConfig),
            Match.tagsExhaustive({
              TeamIsvSplitConfig: (cfg) =>
                teamSplitIsvParser(teamConfig, cfg, sheet),
              TeamIsvCombinedConfig: (cfg) =>
                teamCombinedIsvParser(teamConfig, cfg, sheet),
            }),
          ),
          tags: pipe(
            Match.value(teamConfig.tagsConfig),
            Match.tagsExhaustive({
              TeamTagsConstantsConfig: (cfg) =>
                Effect.succeed(
                  pipe(
                    [],
                    ArrayUtils.WithDefault.wrap<{ tags: readonly string[] }[]>({
                      default: () => ({ tags: cfg.tags }),
                    }),
                  ),
                ),
              TeamTagsRangesConfig: (cfg) =>
                teamRangesTagsParser(teamConfig, cfg, sheet),
            }),
          ),
        }),
        Effect.map(({ base, isv, tags }) =>
          pipe(
            base,
            ArrayUtils.WithDefault.zip(isv),
            ArrayUtils.WithDefault.zip(tags),
          ),
        ),
        Effect.map(ArrayUtils.WithDefault.toArray),
        Effect.map(
          Array.map(
            StructUtils.GetSomeFields.getSomeFields(["lead", "backline"]),
          ),
        ),
        Effect.map(Array.getSomes),
        Effect.map(
          Array.map((config) =>
            Team.make({
              type: teamConfig.name,
              ...config,
            }),
          ),
        ),
      ),
    ),
    Effect.map(Array.flatten),
    Effect.withSpan("teamParser", { captureStackTrace: true }),
  );

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
  "encType",
  "fillRange",
  "overfillRange",
  "standbyRange",
  "visibleCell",
] as const;

type FilteredScheduleConfigValue = Option.Option.Value<
  StructUtils.GetSomeFields.GetSomeFields<
    ScheduleConfig,
    (typeof scheduleConfigFields)[number]
  >
>;
const filterScheduleConfigValues = (scheduleConfigValues: ScheduleConfig[]) =>
  pipe(
    scheduleConfigValues,
    Array.map(StructUtils.GetSomeFields.getSomeFields(scheduleConfigFields)),
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
      Match.when("auto", () => Option.none()),
      Match.orElse(() =>
        Option.some(
          `'${scheduleConfigValue.sheet}'!${scheduleConfigValue.breakRange}`,
        ),
      ),
    ),
  },
  monitor: {
    field: makeScheduleConfigField(scheduleConfigValue, "monitor"),
    range: pipe(
      scheduleConfigValue.monitorRange,
      Option.map(
        (monitorRange) => `'${scheduleConfigValue.sheet}'!${monitorRange}`,
      ),
    ),
  },
  visible: {
    field: makeScheduleConfigField(scheduleConfigValue, "visibleCell"),
    range: Option.some(
      `'${scheduleConfigValue.sheet}'!${scheduleConfigValue.visibleCell}`,
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
          HashMap.set(range.monitor.field, range.monitor.range),
          HashMap.set(range.visible.field, range.visible.range),
        );
      },
    ),
    HashMap.filterMap((a, _) => a),
  );

const runnersInFills =
  (
    runnerConfigMap: HashMap.HashMap<Option.Option<string>, RunnerConfig>,
    hour: number,
  ) =>
  (fills: Option.Option<RawSchedulePlayer>[]) =>
    pipe(
      fills,
      Array.getSomes,
      Array.map((player) =>
        pipe(
          runnerConfigMap,
          HashMap.get(Option.some(player.player)),
          Option.map((config) => ({
            player,
            config,
          })),
        ),
      ),
      Array.getSomes,
      Array.filter(({ config }) =>
        pipe(config.hours, Array.some(HourRange.includes(hour))),
      ),
      Array.map(({ player }) => player),
    );

const baseScheduleParser = (
  scheduleConfigValue: FilteredScheduleConfigValue,
  sheet: HashMap.HashMap<ScheduleConfigField, sheets_v4.Schema$ValueRange>,
) =>
  pipe(
    Effect.Do,
    Effect.let("range", () => scheduleRange(scheduleConfigValue)),
    Effect.flatMap(({ range }) =>
      Effect.all(
        [
          pipe(sheet, getConfigFieldValueRange(range.hours.field)),
          pipe(sheet, getConfigFieldValueRange(range.fills.field)),
          pipe(sheet, getConfigFieldValueRange(range.overfills.field)),
          pipe(sheet, getConfigFieldValueRange(range.standbys.field)),
          pipe(
            Match.value(scheduleConfigValue.breakRange),
            Match.when("auto", () => Effect.succeed({ values: [] })),
            Match.orElse(() =>
              pipe(sheet, getConfigFieldValueRange(range.breaks.field)),
            ),
          ),
          pipe(sheet, getConfigFieldValueRange(range.visible.field)),
        ],
        { concurrency: "unbounded" },
      ),
    ),
    Effect.flatMap((valueRanges) =>
      GoogleSheets.parseValueRanges(
        valueRanges,
        pipe(
          TupleToStructValueSchema(
            ["hour", "fills", "overfills", "standbys", "breakHour", "visible"],
            GoogleSheets.rowSchema,
          ),
          Schema.compose(
            Schema.Struct({
              hour: pipe(
                GoogleSheets.rowToCellSchema,
                Schema.compose(GoogleSheets.cellToNumberSchema),
              ),
              fills: GoogleSheets.rowSchema,
              overfills: pipe(
                GoogleSheets.rowToCellSchema,
                Schema.compose(GoogleSheets.cellToStringArraySchema),
              ),
              standbys: pipe(
                GoogleSheets.rowToCellSchema,
                Schema.compose(GoogleSheets.cellToStringArraySchema),
              ),
              breakHour: pipe(
                GoogleSheets.rowToCellSchema,
                Schema.compose(GoogleSheets.cellToBooleanSchema),
              ),
              visible: pipe(
                GoogleSheets.rowToCellSchema,
                Schema.compose(GoogleSheets.cellToBooleanSchema),
              ),
            }),
          ),
        ),
      ),
    ),
    Effect.map(
      ArrayUtils.WithDefault.wrapEither({
        default: () => ({
          hour: Option.none<number>(),
          fills: [],
          overfills: Option.none<string[]>(),
          standbys: Option.none<string[]>(),
          breakHour: Option.none<boolean>(),
          visible: Option.none<boolean>(),
        }),
      }),
    ),
  );

const scheduleMonitorParser = (
  scheduleConfigValue: FilteredScheduleConfigValue,
  sheet: HashMap.HashMap<ScheduleConfigField, sheets_v4.Schema$ValueRange>,
) => {
  const monitorField = makeScheduleConfigField(scheduleConfigValue, "monitor");
  return pipe(
    sheet,
    getConfigFieldValueRange(monitorField),
    Effect.flatMap((valueRange) =>
      GoogleSheets.parseValueRanges(
        [valueRange],
        pipe(
          TupleToStructValueSchema(["monitor"], GoogleSheets.rowToCellSchema),
          Schema.compose(
            Schema.Struct({
              monitor: GoogleSheets.cellToStringSchema,
            }),
          ),
        ),
      ),
    ),
    Effect.map(
      ArrayUtils.WithDefault.wrapEither({
        default: () => ({
          monitor: Option.none<string>(),
        }),
      }),
    ),
  );
};

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
          Effect.all({
            base: baseScheduleParser(scheduleConfig, sheet),
            monitor: pipe(
              scheduleConfig.monitorRange,
              Option.match({
                onNone: () =>
                  Effect.succeed(
                    pipe(
                      [],
                      ArrayUtils.WithDefault.wrap<
                        {
                          monitor: Option.Option<string>;
                        }[]
                      >({
                        default: () => ({ monitor: Option.none<string>() }),
                      }),
                    ),
                  ),
                onSome: () => scheduleMonitorParser(scheduleConfig, sheet),
              }),
            ),
          }),
          Effect.map(({ base, monitor }) =>
            pipe(base, ArrayUtils.WithDefault.zip(monitor)),
          ),
          Effect.map(ArrayUtils.WithDefault.replaceKeysFromHead("visible")),
          Effect.map(
            ArrayUtils.WithDefault.map(
              ({
                hour,
                fills,
                overfills,
                standbys,
                breakHour,
                visible,
                monitor,
              }) => ({
                hour,
                fills: Array.makeBy(5, (i) =>
                  pipe(
                    Array.get(fills, i),
                    Option.flatten,
                    Option.map((fill) =>
                      RawSchedulePlayer.make({
                        player: fill,
                        enc:
                          scheduleConfig.encType === "regex"
                            ? playerNameRegex.exec(fill)?.groups?.enc !==
                              undefined
                            : false,
                      }),
                    ),
                  ),
                ),
                overfills: pipe(
                  overfills,
                  Option.getOrElse(() => []),
                  Array.map((overfill) =>
                    RawSchedulePlayer.make({
                      player: overfill,
                      enc:
                        scheduleConfig.encType === "regex"
                          ? playerNameRegex.exec(overfill)?.groups?.enc !==
                            undefined
                          : false,
                    }),
                  ),
                ),
                standbys: pipe(
                  standbys,
                  Option.getOrElse(() => []),
                  Array.map((standby) =>
                    RawSchedulePlayer.make({
                      player: standby,
                      enc:
                        scheduleConfig.encType === "regex"
                          ? playerNameRegex.exec(standby)?.groups?.enc !==
                            undefined
                          : false,
                    }),
                  ),
                ),
                breakHour,
                visible: pipe(
                  visible,
                  Option.getOrElse(() => true),
                ),
                monitor,
              }),
            ),
          ),
          Effect.map(
            ArrayUtils.WithDefault.map((config) => ({
              ...config,
              runners: pipe(
                config.hour,
                Option.map((hour) =>
                  pipe(config.fills, runnersInFills(runnerConfigMap, hour)),
                ),
                Option.getOrElse(() => []),
              ),
            })),
          ),
          Effect.map(
            ArrayUtils.WithDefault.map((config) => ({
              ...config,
              breakHour: pipe(
                config.breakHour,
                Option.getOrElse(() =>
                  pipe(
                    Match.value(scheduleConfig.breakRange),
                    Match.when("auto", () =>
                      Array.isEmptyArray(config.runners),
                    ),
                    Match.orElse(() => false),
                  ),
                ),
              ),
            })),
          ),
          Effect.map(ArrayUtils.WithDefault.toArray),
          Effect.map(
            Array.map((config) =>
              makeSchedule({
                channel: scheduleConfig.channel,
                day: scheduleConfig.day,
                ...config,
              }),
            ),
          ),
        ),
      ),
    ),
    Effect.map(Array.flatten),
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
      Computed.flatMap(
        Result.match({
          onOptimistic: (guildConfig) =>
            pipe(
              guildConfig,
              Option.flatMap((guildConfig) => guildConfig.sheetId),
              Option.map(Result.optimistic),
            ),
          onComplete: (guildConfig) =>
            pipe(
              guildConfig,
              Option.flatMap((guildConfig) => guildConfig.sheetId),
              Option.map(Result.complete),
            ),
        }),
      ),
      Computed.map(
        Result.map((sheetId) =>
          SheetService.DefaultWithoutDependencies(sheetId),
        ),
      ),
    );
}
