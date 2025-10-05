import { GoogleSheets } from "@/google/sheets";
import {
  DayConfig,
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
  ParseResult,
  pipe,
  Schema,
  String,
} from "effect";
import { Array as ArrayUtils } from "typhoon-core/utils";
import { DefaultTaggedStruct } from "typhoon-core/schema";
import { Validate } from "typhoon-core/validator";

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
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<DayConfig[], never, never> =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => ({
      channel: GoogleSheets.parseValueRange(channel, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (channel) => ({ channel }),
            onNone: () => ({ channel: "" }),
          }),
          Effect.succeed,
        ),
      ),
      day: GoogleSheets.parseValueRange(day, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
              Schema.compose(
                Schema.OptionFromSelf(
                  Schema.OptionFromSelf(Schema.NumberFromString),
                ),
              ),
            ),
          ),
          Option.flatten,
          Option.flatten,
          (day) => Effect.succeed({ day }),
        ),
      ),
      sheet: GoogleSheets.parseValueRange(sheet, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (sheet) => ({ sheet }),
            onNone: () => ({ sheet: "" }),
          }),
          Effect.succeed,
        ),
      ),
      hourRange: GoogleSheets.parseValueRange(hourRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (hourRange) => ({ hourRange }),
            onNone: () => ({ hourRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      breakRange: GoogleSheets.parseValueRange(breakRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (breakRange) => ({ breakRange }),
            onNone: () => ({ breakRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      monitorRange: GoogleSheets.parseValueRange(monitorRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (monitorRange) => ({ monitorRange }),
            onNone: () => ({ monitorRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      fillRange: GoogleSheets.parseValueRange(fillRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (fillRange) => ({ fillRange }),
            onNone: () => ({ fillRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      overfillRange: GoogleSheets.parseValueRange(overfillRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (overfillRange) => ({ overfillRange }),
            onNone: () => ({ overfillRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      standbyRange: GoogleSheets.parseValueRange(standbyRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (standbyRange) => ({ standbyRange }),
            onNone: () => ({ standbyRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      draft: GoogleSheets.parseValueRange(draft, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (draft) => ({ draft }),
            onNone: () => ({ draft: "" }),
          }),
          Effect.succeed,
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
              array: monitorRange,
              default: { monitorRange: "" },
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
            monitorRange,
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
                    monitorRange,
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
    Effect.bindAll(() => ({
      name: GoogleSheets.parseValueRange(name, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (name) => ({ name }),
            onNone: () => ({ name: "" }),
          }),
          Effect.succeed,
        ),
      ),
      sheet: GoogleSheets.parseValueRange(sheet, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (sheet) => ({ sheet }),
            onNone: () => ({ sheet: "" }),
          }),
          Effect.succeed,
        ),
      ),
      playerNameRange: GoogleSheets.parseValueRange(playerNameRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (playerNameRange) => ({ playerNameRange }),
            onNone: () => ({ playerNameRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      teamNameRange: GoogleSheets.parseValueRange(teamNameRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (teamNameRange) => ({ teamNameRange }),
            onNone: () => ({ teamNameRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      leadRange: GoogleSheets.parseValueRange(leadRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (leadRange) => ({ leadRange }),
            onNone: () => ({ leadRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      backlineRange: GoogleSheets.parseValueRange(backlineRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (backlineRange) => ({ backlineRange }),
            onNone: () => ({ backlineRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      talentRange: GoogleSheets.parseValueRange(talentRange, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (talentRange) => ({ talentRange }),
            onNone: () => ({ talentRange: "" }),
          }),
          Effect.succeed,
        ),
      ),
      tagsType: GoogleSheets.parseValueRange(tagsType, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
              Schema.compose(
                Schema.OptionFromSelf(
                  Schema.OptionFromSelf(
                    pipe(
                      Schema.String,
                      Schema.transformOrFail(
                        Schema.Literal("constants", "ranges"),
                        {
                          strict: true,
                          decode: (str) =>
                            ParseResult.decodeUnknown(
                              Schema.Literal("constants", "ranges"),
                            )(str),
                          encode: (str) => ParseResult.succeed(str),
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (tagsType) => ({ tagsType }),
            onNone: () => ({ tagsType: "constants" as const }),
          }),
          Effect.succeed,
        ),
      ),
      tags: GoogleSheets.parseValueRange(tags, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (tags) => ({ tags }),
            onNone: () => ({ tags: "" }),
          }),
          Effect.succeed,
        ),
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
    Effect.bindAll(() => ({
      name: GoogleSheets.parseValueRange(name, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (name) => ({ name }),
            onNone: () => ({ name: "" }),
          }),
          Effect.succeed,
        ),
      ),
      hours: GoogleSheets.parseValueRange(hours, (arr) =>
        pipe(
          arr,
          Schema.decodeOption(
            pipe(
              Schema.Array(Schema.OptionFromSelf(Schema.String)),
              Schema.head,
            ),
          ),
          Option.flatten,
          Option.flatten,
          Option.match({
            onSome: (hours) => ({ hours: hourRangesParser(hours) }),
            onNone: () => ({ hours: [] }),
          }),
          Effect.succeed,
        ),
      ),
    })),
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
              Validate.validate(
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
                  Schema.transform(RangesConfig, {
                    strict: true,
                    decode: (value) => RangesConfig.make(value),
                    encode: (value) => value,
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
              Schema.decodeUnknown(
                pipe(
                  DefaultTaggedStruct.DefaultTaggedStruct(EventConfig._tag, {
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
                  Schema.compose(EventConfig),
                ),
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
                "'Thee's Sheet Settings'!AA8:AA",
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
