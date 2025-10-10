import { GoogleSheets } from "@/google/sheets";
import {
  ScheduleConfig,
  EventConfig,
  HourRange,
  RangesConfig,
  RunnerConfig,
  TeamConfig,
  TeamTagsConstantsConfig,
  TeamTagsRangesConfig,
} from "@/server/schema";
import { type sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Effect,
  HashMap,
  Number,
  Option,
  pipe,
  Schema,
  String,
} from "effect";
import { Array as ArrayUtils } from "typhoon-core/utils";
import { DefaultTaggedClass } from "typhoon-core/schema";

const dayConfigParser = ([
  channel,
  day,
  sheet,
  hourRange,
  breakRange,
  monitorRange,
  fillRange,
  overfillRange,
  standbyRange,
  draft,
]: sheets_v4.Schema$ValueRange[]) =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => ({
      channel: pipe(
        GoogleSheets.parseValueRangeToStringOption(channel),
        Effect.map(Array.map((channel) => ({ channel }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({ default: { channel: Option.none() } }),
        ),
      ),
      day: pipe(
        GoogleSheets.parseValueRangeToNumberOption(day),
        Effect.map(Array.map((day) => ({ day }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({ default: { day: Option.none() } }),
        ),
      ),
      sheet: pipe(
        GoogleSheets.parseValueRangeToStringOption(sheet),
        Effect.map(Array.map((sheet) => ({ sheet }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({ default: { sheet: Option.none() } }),
        ),
      ),
      hourRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(hourRange),
        Effect.map(Array.map((hourRange) => ({ hourRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { hourRange: Option.none() },
          }),
        ),
      ),
      breakRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(breakRange),
        Effect.map(Array.map((breakRange) => ({ breakRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { breakRange: Option.none() },
          }),
        ),
      ),
      monitorRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(monitorRange),
        Effect.map(Array.map((monitorRange) => ({ monitorRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { monitorRange: Option.none() },
          }),
        ),
      ),
      fillRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(fillRange),
        Effect.map(Array.map((fillRange) => ({ fillRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { fillRange: Option.none() },
          }),
        ),
      ),
      overfillRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(overfillRange),
        Effect.map(Array.map((overfillRange) => ({ overfillRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { overfillRange: Option.none() },
          }),
        ),
      ),
      standbyRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(standbyRange),
        Effect.map(Array.map((standbyRange) => ({ standbyRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { standbyRange: Option.none() },
          }),
        ),
      ),
      draft: pipe(
        GoogleSheets.parseValueRangeToStringOption(draft),
        Effect.map(Array.map((draft) => ({ draft }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({ default: { draft: Option.none() } }),
        ),
      ),
    })),
    Effect.map(
      ({
        channel,
        day,
        sheet,
        hourRange,
        breakRange,
        monitorRange,
        fillRange,
        overfillRange,
        standbyRange,
        draft,
      }) =>
        pipe(
          channel,
          ArrayUtils.WithDefault.zip(day),
          ArrayUtils.WithDefault.zip(sheet),
          ArrayUtils.WithDefault.zip(hourRange),
          ArrayUtils.WithDefault.zip(breakRange),
          ArrayUtils.WithDefault.zip(monitorRange),
          ArrayUtils.WithDefault.zip(fillRange),
          ArrayUtils.WithDefault.zip(overfillRange),
          ArrayUtils.WithDefault.zip(standbyRange),
          ArrayUtils.WithDefault.zip(draft),
        ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.map(
          ({
            channel,
            day,
            sheet,
            hourRange,
            breakRange,
            monitorRange,
            fillRange,
            overfillRange,
            standbyRange,
            draft,
          }) =>
            pipe(
              Option.Do,
              Option.bind("channel", () => channel),
              Option.bind("day", () => day),
              Option.bind("sheet", () => sheet),
              Option.bind("hourRange", () => hourRange),
              Option.bind("breakRange", () => breakRange),
              Option.bind("monitorRange", () => monitorRange),
              Option.bind("fillRange", () => fillRange),
              Option.bind("overfillRange", () => overfillRange),
              Option.bind("standbyRange", () => standbyRange),
              Option.bind("draft", () => draft),
              Option.map((config) => new ScheduleConfig(config)),
            ),
        ),
        Array.getSomes,
      ),
    ),
    Effect.withSpan("dayConfigParser", { captureStackTrace: true }),
  );

export type TeamConfigMap = HashMap.HashMap<string, TeamConfig>;

const teamConfigParser = ([
  name,
  sheet,
  playerNameRange,
  teamNameRange,
  leadRange,
  backlineRange,
  talentRange,
  tagsType,
  tags,
]: sheets_v4.Schema$ValueRange[]) =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => ({
      name: pipe(
        GoogleSheets.parseValueRangeToStringOption(name),
        Effect.map(Array.map((name) => ({ name }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({ default: { name: Option.none() } }),
        ),
      ),
      sheet: pipe(
        GoogleSheets.parseValueRangeToStringOption(sheet),
        Effect.map(Array.map((sheet) => ({ sheet }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({ default: { sheet: Option.none() } }),
        ),
      ),
      playerNameRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(playerNameRange),
        Effect.map(Array.map((playerNameRange) => ({ playerNameRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { playerNameRange: Option.none() },
          }),
        ),
      ),
      teamNameRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(teamNameRange),
        Effect.map(Array.map((teamNameRange) => ({ teamNameRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { teamNameRange: Option.none() },
          }),
        ),
      ),
      leadRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(leadRange),
        Effect.map(Array.map((leadRange) => ({ leadRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { leadRange: Option.none() },
          }),
        ),
      ),
      backlineRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(backlineRange),
        Effect.map(Array.map((backlineRange) => ({ backlineRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { backlineRange: Option.none() },
          }),
        ),
      ),
      talentRange: pipe(
        GoogleSheets.parseValueRangeToStringOption(talentRange),
        Effect.map(Array.map((talentRange) => ({ talentRange }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({
            default: { talentRange: Option.none() },
          }),
        ),
      ),
      tagsType: pipe(
        GoogleSheets.parseValueRangeToLiteralOption(
          ["constants", "ranges"],
          tagsType,
        ),
        Effect.map(Array.map(Option.getOrElse(() => "constants"))),
        Effect.map(Array.map((tagsType) => ({ tagsType }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({ default: { tagsType: "constants" } }),
        ),
      ),
      tags: pipe(
        GoogleSheets.parseValueRangeToStringOption(tags),
        Effect.map(Array.map(Option.getOrElse(() => ""))),
        Effect.map(Array.map((tags) => ({ tags }))),
        Effect.map(ArrayUtils.WithDefault.wrap({ default: { tags: "" } })),
      ),
    })),
    Effect.map(
      ({
        name,
        sheet,
        playerNameRange,
        teamNameRange,
        leadRange,
        backlineRange,
        talentRange,
        tagsType,
        tags,
      }) =>
        pipe(
          name,
          ArrayUtils.WithDefault.zip(sheet),
          ArrayUtils.WithDefault.zip(playerNameRange),
          ArrayUtils.WithDefault.zip(teamNameRange),
          ArrayUtils.WithDefault.zip(leadRange),
          ArrayUtils.WithDefault.zip(backlineRange),
          ArrayUtils.WithDefault.zip(talentRange),
          ArrayUtils.WithDefault.zip(tagsType),
          ArrayUtils.WithDefault.zip(tags),
          ArrayUtils.WithDefault.toArray,
        ),
    ),
    Effect.map((array) =>
      pipe(
        array,
        Array.map(
          ({
            name,
            sheet,
            playerNameRange,
            teamNameRange,
            leadRange,
            backlineRange,
            talentRange,
            tagsType,
            tags,
          }) =>
            pipe(
              Option.Do,
              Option.bind("name", () => name),
              Option.bind("sheet", () => sheet),
              Option.bind("playerNameRange", () => playerNameRange),
              Option.bind("teamNameRange", () => teamNameRange),
              Option.bind("leadRange", () => leadRange),
              Option.bind("backlineRange", () => backlineRange),
              Option.bind("talentRange", () => talentRange),
              Option.let("tagsType", () => tagsType),
              Option.let("tags", () => tags),
              Option.map(
                ({ tagsType, tags, ...config }) =>
                  new TeamConfig({
                    ...config,
                    tagsConfig:
                      tagsType === "constants"
                        ? new TeamTagsConstantsConfig({
                            tags: pipe(
                              tags,
                              String.split(","),
                              Array.map(String.trim),
                              Array.filter(String.isNonEmpty),
                            ),
                          })
                        : new TeamTagsRangesConfig({ tagsRange: tags }),
                  }),
              ),
            ),
        ),
        Array.getSomes,
        ArrayUtils.Collect.toHashMap({
          keyGetter: ({ name }) => name,
          valueInitializer: (a) => a,
          valueReducer: (_, a) => a,
        }),
      ),
    ),
    Effect.withSpan("teamConfigParser", { captureStackTrace: true }),
  );

const hourRangeParser = (range: string): HourRange =>
  pipe(
    pipe(
      range,
      String.split("-"),
      Array.map(String.trim),
      ([start, end]) =>
        new HourRange({
          start: parseInt(start, 10),
          end: parseInt(end, 10),
        }),
    ),
  );

export type RunnerConfigMap = HashMap.HashMap<string, RunnerConfig>;

const runnerConfigParser = ([name, hours]: sheets_v4.Schema$ValueRange[]) =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => ({
      name: pipe(
        GoogleSheets.parseValueRangeToStringOption(name),
        Effect.map(Array.map((name) => ({ name }))),
        Effect.map(
          ArrayUtils.WithDefault.wrap({ default: { name: Option.none() } }),
        ),
      ),
      hours: pipe(
        GoogleSheets.parseValueRangeFromStringListToStringArray(hours),
        Effect.map(Array.map(Array.map(hourRangeParser))),
        Effect.map(Array.map((hours) => ({ hours }))),
        Effect.map(ArrayUtils.WithDefault.wrap({ default: { hours: [] } })),
      ),
    })),
    Effect.map(({ name, hours }) =>
      pipe(
        name,
        ArrayUtils.WithDefault.zip(hours),
        ArrayUtils.WithDefault.toArray,
        Array.map(({ name, hours }) =>
          pipe(
            Option.Do,
            Option.bind("name", () => name),
            Option.let("hours", () => hours),
            Option.map(({ name, hours }) => new RunnerConfig({ name, hours })),
          ),
        ),
        Array.getSomes,
        ArrayUtils.Collect.toHashMap({
          keyGetter: ({ name }) => name,
          valueInitializer: (a) => a,
          valueReducer: (_, a) => a,
        }),
      ),
    ),
    Effect.withSpan("runnerConfigParser", { captureStackTrace: true }),
  );

export class SheetConfigService extends Effect.Service<SheetConfigService>()(
  "SheetConfigService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("sheet", () => GoogleSheets),
      Effect.map(({ sheet }) => ({
        getRangesConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: ["'Thee's Sheet Settings'!B8:C"],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.flatMap(Array.get(0)),
                Option.flatMap((range) => Option.fromNullable(range.values)),
                Option.map(Object.fromEntries),
              ),
            ),
            Effect.flatMap(
              Schema.decodeUnknown(
                pipe(
                  Schema.Struct({
                    "User IDs": Schema.String,
                    "User Sheet Names": Schema.String,
                    Hours: Schema.String,
                    Breaks: Schema.String,
                    Fills: Schema.String,
                    Overfills: Schema.String,
                    Standbys: Schema.String,
                  }),
                  Schema.rename({
                    "User IDs": "userIds",
                    "User Sheet Names": "userSheetNames",
                    Hours: "hours",
                    Breaks: "breaks",
                    Fills: "fills",
                    Overfills: "overfills",
                    Standbys: "standbys",
                  }),
                  Schema.compose(
                    DefaultTaggedClass.DefaultTaggedClass(RangesConfig),
                  ),
                ),
              ),
            ),
            Effect.withSpan("SheetConfigService.getRangesConfig", {
              captureStackTrace: true,
            }),
          ),
        getTeamConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: [
                "'Thee's Sheet Settings'!E8:E",
                "'Thee's Sheet Settings'!F8:F",
                "'Thee's Sheet Settings'!G8:G",
                "'Thee's Sheet Settings'!H8:H",
                "'Thee's Sheet Settings'!I8:I",
                "'Thee's Sheet Settings'!J8:J",
                "'Thee's Sheet Settings'!K8:K",
                "'Thee's Sheet Settings'!L8:L",
                "'Thee's Sheet Settings'!M8:M",
              ],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.map(teamConfigParser),
                Effect.transposeOption,
                Effect.flatten,
                Effect.provideService(GoogleSheets, sheet),
              ),
            ),
            Effect.withSpan("SheetConfigService.getTeamConfig", {
              captureStackTrace: true,
            }),
          ),
        getEventConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: ["'Thee's Sheet Settings'!O8:P"],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.flatMap(Array.get(0)),
                Option.flatMap((range) => Option.fromNullable(range.values)),
                Option.map(Object.fromEntries),
              ),
            ),
            Effect.flatMap(
              Schema.decodeUnknown(
                pipe(
                  Schema.Struct({
                    "Start Time": pipe(
                      Schema.NumberFromString,
                      Schema.transform(Schema.Number, {
                        strict: true,
                        decode: Number.multiply(1000),
                        encode: Number.unsafeDivide(1000),
                      }),
                    ),
                  }),
                  Schema.rename({
                    "Start Time": "startTime",
                  }),
                  Schema.compose(
                    DefaultTaggedClass.DefaultTaggedClass(EventConfig),
                  ),
                ),
              ),
            ),
            Effect.withSpan("SheetConfigService.getEventConfig", {
              captureStackTrace: true,
            }),
          ),
        getScheduleConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: [
                "'Thee's Sheet Settings'!R8:R",
                "'Thee's Sheet Settings'!S8:S",
                "'Thee's Sheet Settings'!T8:T",
                "'Thee's Sheet Settings'!U8:U",
                "'Thee's Sheet Settings'!V8:V",
                "'Thee's Sheet Settings'!W8:W",
                "'Thee's Sheet Settings'!X8:X",
                "'Thee's Sheet Settings'!Y8:Y",
                "'Thee's Sheet Settings'!Z8:Z",
                "'Thee's Sheet Settings'!AA8:AA",
              ],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.map(dayConfigParser),
                Effect.transposeOption,
                Effect.flatten,
                Effect.provideService(GoogleSheets, sheet),
              ),
            ),
            Effect.withSpan("SheetConfigService.getScheduleConfig", {
              captureStackTrace: true,
            }),
          ),
        getRunnerConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: [
                "'Thee's Sheet Settings'!AC8:AC",
                "'Thee's Sheet Settings'!AD8:AD",
              ],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.map(runnerConfigParser),
                Effect.transposeOption,
                Effect.flatten,
                Effect.provideService(GoogleSheets, sheet),
              ),
            ),
            Effect.withSpan("SheetConfigService.getRunnerConfig", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [GoogleSheets.Default],
    accessors: true,
  },
) {}
