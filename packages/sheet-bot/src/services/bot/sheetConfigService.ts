import { type sheets_v4 } from "@googleapis/sheets";
import { type } from "arktype";
import { Array, Effect, Equal, HashMap, Option, pipe, String } from "effect";
import { validate, validateWithDefault } from "typhoon-core/schema";
import { ArrayWithDefault, collectArrayToHashMap } from "typhoon-server/utils";
import { GoogleSheets } from "../../google/sheets";
import { bindObject } from "../../utils";

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

export type DayConfig = {
  day: number;
  sheet: string;
  draft: string;
};
export type DayConfigMap = HashMap.HashMap<number, DayConfig>;

const dayConfigParser = ([
  day,
  sheet,
  draft,
]: sheets_v4.Schema$ValueRange[]): Effect.Effect<DayConfigMap, never, never> =>
  pipe(
    Effect.Do,
    bindObject({
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
    Effect.map(({ day, sheet, draft }) =>
      pipe(
        new ArrayWithDefault({ array: day, default: { day: Option.none() } }),
        ArrayWithDefault.zip(
          new ArrayWithDefault({ array: sheet, default: { sheet: "" } }),
        ),
        ArrayWithDefault.zip(
          new ArrayWithDefault({ array: draft, default: { draft: "" } }),
        ),
      ),
    ),
    Effect.map(({ array }) =>
      pipe(
        array,
        Array.map(({ day, sheet, draft }) =>
          pipe(
            day,
            Option.map((day) => ({ day, sheet, draft })),
          ),
        ),
        Array.getSomes,
        collectArrayToHashMap({
          keyGetter: ({ day }) => day,
          keyValueReducer: (_, b) => b,
        }),
      ),
    ),
    Effect.withSpan("dayConfigParser", { captureStackTrace: true }),
  );

export type TeamConfig = {
  name: string;
  range: string;
  tags: string[];
};
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
        collectArrayToHashMap({
          keyGetter: ({ name }) => name,
          keyValueReducer: (_, b) => b,
        }),
      ),
    ),
    Effect.withSpan("teamConfigParser", { captureStackTrace: true }),
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
            Effect.map((response) =>
              Object.fromEntries(response.data.valueRanges?.[0]?.values ?? []),
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
              teamConfigParser(response.data.valueRanges ?? []),
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
            Effect.map((response) =>
              Object.fromEntries(response.data.valueRanges?.[0]?.values ?? []),
            ),
            Effect.flatMap(
              validate(
                type({
                  "Start Time": "string | number",
                }).pipe((config) => ({
                  startTime:
                    typeof config["Start Time"] === "number"
                      ? config["Start Time"]
                      : parseInt(config["Start Time"]),
                })),
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
                "'Thee's Sheet Settings'!P8:P",
                "'Thee's Sheet Settings'!Q8:Q",
                "'Thee's Sheet Settings'!R8:R",
              ],
            }),
            Effect.flatMap((response) =>
              dayConfigParser(response.data.valueRanges ?? []),
            ),
            Effect.withSpan("SheetConfigService.getDayConfig", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    dependencies: [GoogleSheets.Default],
    accessors: true,
  },
) {}
