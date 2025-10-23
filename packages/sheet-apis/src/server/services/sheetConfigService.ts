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

const scheduleConfigParser = ([range]: sheets_v4.Schema$ValueRange[]) =>
  pipe(
    GoogleSheets.parseValueRange(
      range,
      pipe(
        GoogleSheets.rangeToStructOptionSchema([
          "channel",
          "day",
          "sheet",
          "hourRange",
          "breakRange",
          "monitorRange",
          "fillRange",
          "overfillRange",
          "standbyRange",
          "screenshotRange",
          "draft",
        ]),
        Schema.compose(
          Schema.Struct({
            channel: GoogleSheets.cellToStringSchema,
            day: GoogleSheets.cellToNumberSchema,
            sheet: GoogleSheets.cellToStringSchema,
            hourRange: GoogleSheets.cellToStringSchema,
            breakRange: GoogleSheets.cellToStringSchema,
            monitorRange: GoogleSheets.cellToStringSchema,
            fillRange: GoogleSheets.cellToStringSchema,
            overfillRange: GoogleSheets.cellToStringSchema,
            standbyRange: GoogleSheets.cellToStringSchema,
            screenshotRange: GoogleSheets.cellToStringSchema,
            draft: GoogleSheets.cellToStringSchema,
          }),
        ),
        Schema.compose(DefaultTaggedClass.DefaultTaggedClass(ScheduleConfig)),
      ),
    ),
    Effect.tap(() => Effect.log(range.values)),
    Effect.tap((config) => Effect.log(config)),
    Effect.map(Array.getSomes),
    Effect.withSpan("scheduleConfigParser", { captureStackTrace: true }),
  );

export type TeamConfigMap = HashMap.HashMap<string, TeamConfig>;

const teamConfigParser = ([range]: sheets_v4.Schema$ValueRange[]) =>
  pipe(
    GoogleSheets.parseValueRange(
      range,
      GoogleSheets.rangeToStructOptionSchema([
        "name",
        "sheet",
        "playerNameRange",
        "teamNameRange",
        "leadRange",
        "backlineRange",
        "talentRange",
        "tagsType",
        "tags",
      ]),
    ),
    Effect.map(Array.getSomes),
    Effect.flatMap(
      Effect.forEach(
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
            Effect.Do,
            Effect.bindAll(() => ({
              name: Effect.succeed(name),
              sheet: Effect.succeed(sheet),
              playerNameRange: Effect.succeed(playerNameRange),
              teamNameRange: Effect.succeed(teamNameRange),
              leadRange: Effect.succeed(leadRange),
              backlineRange: Effect.succeed(backlineRange),
              talentRange: Effect.succeed(talentRange),
              tagsType: pipe(
                tagsType,
                Effect.transposeMapOption(
                  Schema.decode(
                    GoogleSheets.toLiteralSchema(["constants", "ranges"]),
                  ),
                ),
                Effect.map(Option.orElseSome(() => "constants" as const)),
              ),
              tags: pipe(
                Effect.succeed(tags),
                Effect.map(Option.orElseSome(() => "")),
              ),
            })),
          ),
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
              Option.bind("tagsType", () => tagsType),
              Option.bind("tags", () => tags),
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
                  }),
                  Schema.rename({
                    "User IDs": "userIds",
                    "User Sheet Names": "userSheetNames",
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
              ranges: ["'Thee's Sheet Settings'!E8:M"],
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
              ranges: ["'Thee's Sheet Settings'!R8:AB"],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.map(scheduleConfigParser),
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
                "'Thee's Sheet Settings'!AD8:AD",
                "'Thee's Sheet Settings'!AE8:AE",
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
