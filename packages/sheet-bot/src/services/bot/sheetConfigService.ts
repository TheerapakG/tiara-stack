import { GoogleSheets } from "@/google/sheets";
import { bindObject } from "@/utils";
import { type sheets_v4 } from "@googleapis/sheets";
import {
  Array,
  Data,
  DateTime,
  Effect,
  Equal,
  HashMap,
  Option,
  pipe,
  Schema,
  String,
} from "effect";
import { Array as ArrayUtils } from "typhoon-core/utils";
import { validate, validateOption } from "typhoon-core/validator";

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
          pipe(
            v,
            Option.liftPredicate(() => !Equal.equals(v, "")),
            Option.flatMapNullable((v) => v as string | null | undefined),
          ),
        ),
      ),
    ),
    Option.map(Effect.forEach(rowParser)),
    Option.getOrElse(() => Effect.succeed([])),
    Effect.withSpan("parseValueRange", { captureStackTrace: true }),
  );

export class DayConfig extends Data.TaggedClass("DayConfig")<{
  channel: string;
  day: number;
  sheet: string;
  hourRange: string;
  breakRange: string;
  fillRange: string;
  overfillRange: string;
  standbyRange: string;
  draft: string;
}> {}

const dayConfigParser = ([
  channel,
  day,
  sheet,
  hourRange,
  breakRange,
  fillRange,
  overfillRange,
  standbyRange,
  draft,
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<DayConfig[], never, never> =>
  pipe(
    Effect.Do,
    bindObject({
      channel: parseValueRange(channel, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (channel) => ({ channel }),
              onNone: () => ({ channel: "" }),
            }),
          ),
        ),
      ),
      day: parseValueRange(day, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(
              pipe(Schema.NumberFromString, Schema.standardSchemaV1),
            ),
          ),
          Effect.map(Option.flatten),
          Effect.map((day) => ({ day })),
        ),
      ),
      sheet: parseValueRange(sheet, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (sheet) => ({ sheet }),
              onNone: () => ({ sheet: "" }),
            }),
          ),
        ),
      ),
      hourRange: parseValueRange(hourRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (hourRange) => ({ hourRange }),
              onNone: () => ({ hourRange: "" }),
            }),
          ),
        ),
      ),
      breakRange: parseValueRange(breakRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (breakRange) => ({ breakRange }),
              onNone: () => ({ breakRange: "" }),
            }),
          ),
        ),
      ),
      fillRange: parseValueRange(fillRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (fillRange) => ({ fillRange }),
              onNone: () => ({ fillRange: "" }),
            }),
          ),
        ),
      ),
      overfillRange: parseValueRange(overfillRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (overfillRange) => ({ overfillRange }),
              onNone: () => ({ overfillRange: "" }),
            }),
          ),
        ),
      ),
      standbyRange: parseValueRange(standbyRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (standbyRange) => ({ standbyRange }),
              onNone: () => ({ standbyRange: "" }),
            }),
          ),
        ),
      ),
      draft: parseValueRange(draft, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (draft) => ({ draft }),
              onNone: () => ({ draft: "" }),
            }),
          ),
        ),
      ),
    }),
    Effect.map(
      ({
        channel,
        day,
        sheet,
        hourRange,
        breakRange,
        fillRange,
        overfillRange,
        standbyRange,
        draft,
      }) =>
        pipe(
          new ArrayUtils.WithDefault.ArrayWithDefault({
            array: channel,
            default: { channel: "" },
          }),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: day,
              default: { day: Option.none<number>() },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: sheet,
              default: { sheet: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: hourRange,
              default: { hourRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: breakRange,
              default: { breakRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: fillRange,
              default: { fillRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: overfillRange,
              default: { overfillRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: standbyRange,
              default: { standbyRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: draft,
              default: { draft: "" },
            }),
          ),
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
            fillRange,
            overfillRange,
            standbyRange,
            draft,
          }) =>
            pipe(
              day,
              Option.map(
                (day) =>
                  new DayConfig({
                    channel,
                    day,
                    sheet,
                    hourRange,
                    breakRange,
                    fillRange,
                    overfillRange,
                    standbyRange,
                    draft,
                  }),
              ),
            ),
        ),
        Array.getSomes,
      ),
    ),
    Effect.withSpan("dayConfigParser", { captureStackTrace: true }),
  );

export class TeamTagsConstantsConfig extends Data.TaggedClass(
  "TeamTagsConstantsConfig",
)<{
  tags: string[];
}> {}

export class TeamTagsRangesConfig extends Data.TaggedClass(
  "TeamTagsRangesConfig",
)<{
  tagsRange: string;
}> {}

export class TeamConfig extends Data.TaggedClass("TeamConfig")<{
  name: string;
  sheet: string;
  playerNameRange: string;
  teamNameRange: string;
  leadRange: string;
  backlineRange: string;
  talentRange: string;
  tagsConfig: TeamTagsConstantsConfig | TeamTagsRangesConfig;
}> {}
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
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<TeamConfigMap, never, never> =>
  pipe(
    Effect.Do,
    bindObject({
      name: parseValueRange(name, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (name) => ({ name }),
              onNone: () => ({ name: "" }),
            }),
          ),
        ),
      ),
      sheet: parseValueRange(sheet, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (sheet) => ({ sheet }),
              onNone: () => ({ sheet: "" }),
            }),
          ),
        ),
      ),
      playerNameRange: parseValueRange(playerNameRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (playerNameRange) => ({ playerNameRange }),
              onNone: () => ({ playerNameRange: "" }),
            }),
          ),
        ),
      ),
      teamNameRange: parseValueRange(teamNameRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (teamNameRange) => ({ teamNameRange }),
              onNone: () => ({ teamNameRange: "" }),
            }),
          ),
        ),
      ),
      leadRange: parseValueRange(leadRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (leadRange) => ({ leadRange }),
              onNone: () => ({ leadRange: "" }),
            }),
          ),
        ),
      ),
      backlineRange: parseValueRange(backlineRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (backlineRange) => ({ backlineRange }),
              onNone: () => ({ backlineRange: "" }),
            }),
          ),
        ),
      ),
      talentRange: parseValueRange(talentRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (talentRange) => ({ talentRange }),
              onNone: () => ({ talentRange: "" }),
            }),
          ),
        ),
      ),
      tagsType: parseValueRange(tagsType, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(
              pipe(
                Schema.Literal("constants", "ranges"),
                Schema.standardSchemaV1,
              ),
            ),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (tagsType) => ({ tagsType }),
              onNone: () => ({ tagsType: "constants" }),
            }),
          ),
        ),
      ),
      tags: parseValueRange(tags, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (tags) => ({ tags }),
              onNone: () => ({ tags: "" }),
            }),
          ),
        ),
      ),
    }),
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
          new ArrayUtils.WithDefault.ArrayWithDefault({
            array: name,
            default: { name: "" },
          }),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: sheet,
              default: { sheet: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: playerNameRange,
              default: { playerNameRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: teamNameRange,
              default: { teamNameRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: leadRange,
              default: { leadRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: backlineRange,
              default: { backlineRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: talentRange,
              default: { talentRange: "" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: tagsType,
              default: { tagsType: "constants" },
            }),
          ),
          ArrayUtils.WithDefault.zip(
            new ArrayUtils.WithDefault.ArrayWithDefault({
              array: tags,
              default: { tags: "" },
            }),
          ),
        ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.filter(({ name }) => name !== ""),
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
            new TeamConfig({
              name,
              sheet,
              playerNameRange,
              teamNameRange,
              leadRange,
              backlineRange,
              talentRange,
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
        ArrayUtils.Collect.toHashMap({
          keyGetter: ({ name }) => name,
          valueInitializer: (a) => a,
          valueReducer: (_, a) => a,
        }),
      ),
    ),
    Effect.withSpan("teamConfigParser", { captureStackTrace: true }),
  );

export class HourRange extends Data.TaggedClass("HourRange")<{
  start: number;
  end: number;
}> {
  static includes = (hour: number) => (hourRange: HourRange) =>
    hour >= hourRange.start && hour <= hourRange.end;
}

const hourRangesParser = (ranges: string): HourRange[] =>
  pipe(
    ranges,
    String.split(","),
    Array.map(String.trim),
    Array.map((range) =>
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
    ),
  );

export class RunnerConfig extends Data.TaggedClass("RunnerConfig")<{
  name: string;
  hours: HourRange[];
}> {}

export type RunnerConfigMap = HashMap.HashMap<string, RunnerConfig>;

const runnerConfigParser = ([
  name,
  hours,
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<
  RunnerConfigMap,
  never,
  never
> =>
  pipe(
    Effect.Do,
    bindObject({
      name: parseValueRange(name, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (name) => ({ name }),
              onNone: () => ({ name: "" }),
            }),
          ),
        ),
      ),
      hours: parseValueRange(hours, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Effect.transposeMapOption(
            validateOption(pipe(Schema.String, Schema.standardSchemaV1)),
          ),
          Effect.map(Option.flatten),
          Effect.map(
            Option.match({
              onSome: (hours) => ({ hours: hourRangesParser(hours) }),
              onNone: () => ({ hours: [] }),
            }),
          ),
        ),
      ),
    }),
    Effect.map(({ name, hours }) =>
      pipe(
        new ArrayUtils.WithDefault.ArrayWithDefault({
          array: name,
          default: { name: "" },
        }),
        ArrayUtils.WithDefault.zip(
          new ArrayUtils.WithDefault.ArrayWithDefault({
            array: hours,
            default: { hours: [] },
          }),
        ),
        ArrayUtils.WithDefault.map(
          ({ name, hours }) => new RunnerConfig({ name, hours }),
        ),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.filter(({ name }) => name !== ""),
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
              validate(
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
                  Schema.standardSchemaV1,
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
              validate(
                pipe(
                  Schema.Struct({
                    "Start Time": Schema.NumberFromString,
                  }),
                  Schema.rename({
                    "Start Time": "startTime",
                  }),
                  Schema.standardSchemaV1,
                ),
              ),
            ),
            Effect.flatMap(({ startTime }) =>
              pipe(
                startTime * 1000,
                DateTime.make,
                Option.map((startTime) => ({ startTime })),
              ),
            ),
            Effect.withSpan("SheetConfigService.getEventConfig", {
              captureStackTrace: true,
            }),
          ),
        getDayConfig: (sheetId: string) =>
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
              ],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.map(dayConfigParser),
                Effect.transposeOption,
                Effect.flatten,
              ),
            ),
            Effect.withSpan("SheetConfigService.getDayConfig", {
              captureStackTrace: true,
            }),
          ),
        getRunnerConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: [
                "'Thee's Sheet Settings'!AB8:AB",
                "'Thee's Sheet Settings'!AC8:AC",
              ],
            }),
            Effect.flatMap((response) =>
              pipe(
                Option.fromNullable(response.data.valueRanges),
                Option.map(runnerConfigParser),
                Effect.transposeOption,
                Effect.flatten,
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
