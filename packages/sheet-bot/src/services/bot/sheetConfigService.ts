import { GoogleSheets } from "@/google/sheets";
import { bindObject } from "@/utils";
import { type sheets_v4 } from "@googleapis/sheets";
import { type } from "arktype";
import {
  Array,
  Data,
  DateTime,
  Effect,
  Equal,
  HashMap,
  Option,
  pipe,
  String,
} from "effect";
import { validate, validateWithDefault } from "typhoon-core/schema";
import { ArrayWithDefault, collectArrayToHashMap } from "typhoon-server/utils";

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
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((channel) => ({ channel })),
              { channel: "" },
            ),
            onNone: () => Effect.succeed({ channel: "" }),
          }),
        ),
      ),
      day: parseValueRange(day, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string.integer.parse").pipe((day) => ({
                day: Option.some(day),
              })),
              { day: Option.none<number>() },
            ),
            onNone: () => Effect.succeed({ day: Option.none() }),
          }),
        ),
      ),
      sheet: parseValueRange(sheet, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((sheet) => ({ sheet })),
              { sheet: "" },
            ),
            onNone: () => Effect.succeed({ sheet: "" }),
          }),
        ),
      ),
      hourRange: parseValueRange(hourRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((hourRange) => ({ hourRange })),
              { hourRange: "" },
            ),
            onNone: () => Effect.succeed({ hourRange: "" }),
          }),
        ),
      ),
      breakRange: parseValueRange(breakRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((breakRange) => ({ breakRange })),
              { breakRange: "" },
            ),
            onNone: () => Effect.succeed({ breakRange: "" }),
          }),
        ),
      ),
      fillRange: parseValueRange(fillRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((fillRange) => ({ fillRange })),
              { fillRange: "" },
            ),
            onNone: () => Effect.succeed({ fillRange: "" }),
          }),
        ),
      ),
      overfillRange: parseValueRange(overfillRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((overfillRange) => ({ overfillRange })),
              { overfillRange: "" },
            ),
            onNone: () => Effect.succeed({ overfillRange: "" }),
          }),
        ),
      ),
      standbyRange: parseValueRange(standbyRange, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((standbyRange) => ({ standbyRange })),
              { standbyRange: "" },
            ),
            onNone: () => Effect.succeed({ standbyRange: "" }),
          }),
        ),
      ),
      draft: parseValueRange(draft, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((draft) => ({ draft })),
              { draft: "" },
            ),
            onNone: () => Effect.succeed({ draft: "" }),
          }),
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
          new ArrayWithDefault({ array: channel, default: { channel: "" } }),
          ArrayWithDefault.zip(
            new ArrayWithDefault({
              array: day,
              default: { day: Option.none() },
            }),
          ),
          ArrayWithDefault.zip(
            new ArrayWithDefault({ array: sheet, default: { sheet: "" } }),
          ),
          ArrayWithDefault.zip(
            new ArrayWithDefault({
              array: hourRange,
              default: { hourRange: "" },
            }),
          ),
          ArrayWithDefault.zip(
            new ArrayWithDefault({
              array: breakRange,
              default: { breakRange: "" },
            }),
          ),
          ArrayWithDefault.zip(
            new ArrayWithDefault({
              array: fillRange,
              default: { fillRange: "" },
            }),
          ),
          ArrayWithDefault.zip(
            new ArrayWithDefault({
              array: overfillRange,
              default: { overfillRange: "" },
            }),
          ),
          ArrayWithDefault.zip(
            new ArrayWithDefault({
              array: standbyRange,
              default: { standbyRange: "" },
            }),
          ),
          ArrayWithDefault.zip(
            new ArrayWithDefault({ array: draft, default: { draft: "" } }),
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

export class TeamConfig extends Data.TaggedClass("TeamConfig")<{
  name: string;
  range: string;
  tags: string[];
}> {}
export type TeamConfigMap = HashMap.HashMap<string, TeamConfig>;

const teamConfigParser = ([
  name,
  range,
  tags,
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<TeamConfigMap, never, never> =>
  pipe(
    Effect.Do,
    bindObject({
      name: parseValueRange(name, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((name) => ({ name })),
              { name: "" },
            ),
            onNone: () => Effect.succeed({ name: "" }),
          }),
        ),
      ),
      range: parseValueRange(range, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((range) => ({ range })),
              { range: "" },
            ),
            onNone: () => Effect.succeed({ range: "" }),
          }),
        ),
      ),
      tags: parseValueRange(tags, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((tags) => ({
                tags: pipe(
                  tags,
                  String.split(","),
                  Array.map(String.trim),
                  Array.filter(String.isNonEmpty),
                ),
              })),
              { tags: [] },
            ),
            onNone: () => Effect.succeed({ tags: [] }),
          }),
        ),
      ),
    }),
    Effect.map(({ name, range, tags }) =>
      pipe(
        new ArrayWithDefault({ array: name, default: { name: "" } }),
        ArrayWithDefault.zip(
          new ArrayWithDefault({ array: range, default: { range: "" } }),
        ),
        ArrayWithDefault.zip(
          new ArrayWithDefault({ array: tags, default: { tags: [] } }),
        ),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.filter(({ name }) => name !== ""),
        Array.map(
          ({ name, range, tags }) => new TeamConfig({ name, range, tags }),
        ),
        collectArrayToHashMap({
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
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((name) => ({ name })),
              { name: "" },
            ),
            onNone: () => Effect.succeed({ name: "" }),
          }),
        ),
      ),
      hours: parseValueRange(hours, (arr) =>
        pipe(
          Array.get(arr, 0),
          Option.flatten,
          Option.match({
            onSome: validateWithDefault(
              type("string").pipe((hours) => ({
                hours: hourRangesParser(hours),
              })),
              { hours: [] },
            ),
            onNone: () => Effect.succeed({ hours: [] }),
          }),
        ),
      ),
    }),
    Effect.map(({ name, hours }) =>
      pipe(
        new ArrayWithDefault({ array: name, default: { name: "" } }),
        ArrayWithDefault.zip(
          new ArrayWithDefault({ array: hours, default: { hours: [] } }),
        ),
        ArrayWithDefault.map(
          ({ name, hours }) => new RunnerConfig({ name, hours }),
        ),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.filter(({ name }) => name !== ""),
        collectArrayToHashMap({
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
                type({
                  "User IDs": "string",
                  "User Sheet Names": "string",
                  Hours: "string",
                  Breaks: "string",
                  Fills: "string",
                  Overfills: "string",
                  Standbys: "string",
                }).pipe((config) => ({
                  userIds: config["User IDs"],
                  userSheetNames: config["User Sheet Names"],
                  hours: config["Hours"],
                  breaks: config["Breaks"],
                  fills: config["Fills"],
                  overfills: config["Overfills"],
                  standbys: config["Standbys"],
                })),
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
              ranges: ["'Thee's Sheet Settings'!I8:J"],
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
                type({
                  "Start Time": "string.integer.parse",
                }).pipe((config) => ({
                  startTime: DateTime.make(config["Start Time"] * 1000),
                })),
              ),
            ),
            Effect.flatMap(({ startTime }) =>
              pipe(
                startTime,
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
                "'Thee's Sheet Settings'!L8:L",
                "'Thee's Sheet Settings'!M8:M",
                "'Thee's Sheet Settings'!N8:N",
                "'Thee's Sheet Settings'!O8:O",
                "'Thee's Sheet Settings'!P8:P",
                "'Thee's Sheet Settings'!Q8:Q",
                "'Thee's Sheet Settings'!R8:R",
                "'Thee's Sheet Settings'!S8:S",
                "'Thee's Sheet Settings'!T8:T",
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
                "'Thee's Sheet Settings'!V8:V",
                "'Thee's Sheet Settings'!W8:W",
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
