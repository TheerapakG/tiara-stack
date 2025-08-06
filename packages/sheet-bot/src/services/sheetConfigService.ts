import { type sheets_v4 } from "@googleapis/sheets";
import { type } from "arktype";
import { Array, Effect, HashMap, Option, pipe } from "effect";
import { validate } from "typhoon-core/schema";
import { GoogleSheets } from "../google/sheets";

const parseValueRange = <A = never, E = never, R = never>(
  valueRange: sheets_v4.Schema$ValueRange,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowParser: (row: readonly any[], index: number) => Effect.Effect<A, E, R>,
): Effect.Effect<A[], E, R> =>
  pipe(
    Option.fromNullable(valueRange.values),
    Option.map(Effect.forEach(rowParser)),
    Option.getOrElse(() => Effect.succeed([])),
  );

const zipRows =
  <B>(b: B[]) =>
  <A>(a: A[]) =>
    pipe(
      a,
      Array.zip(b),
      Array.map(([a, b]) => ({ ...a, ...b })),
    );

export type DayConfig = {
  day: number;
  sheet: string;
  draft: string;
};
export type DayConfigMap = HashMap.HashMap<number, DayConfig>;

const dayConfigParser = (
  valueRange: sheets_v4.Schema$ValueRange[] | undefined,
): Effect.Effect<DayConfigMap, never, never> =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => {
      const [day, sheet, draft] = valueRange ?? [];
      return {
        day: parseValueRange(day, ([day]) =>
          Effect.succeed({
            day: parseInt(day, 10),
          }),
        ),
        sheet: parseValueRange(sheet, ([sheet]) =>
          Effect.succeed({
            sheet: sheet,
          }),
        ),
        draft: parseValueRange(draft, ([draft]) =>
          Effect.succeed({
            draft: draft,
          }),
        ),
      };
    }),
    Effect.map(({ day, sheet, draft }) =>
      pipe(
        day,
        zipRows(sheet),
        zipRows(draft),
        Array.map(({ day, sheet, draft }) => ({
          day,
          sheet,
          draft,
        })),
        Array.filter(({ day }) => !isNaN(day)),
        Array.map(
          ({ day, sheet, draft }) => [day, { day, sheet, draft }] as const,
        ),
        HashMap.fromIterable,
      ),
    ),
    Effect.withSpan("scheduleParser", { captureStackTrace: true }),
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
                  "User Teams": "string",
                  Hours: "string",
                  Breaks: "string",
                  Fills: "string",
                  Overfills: "string",
                  Standbys: "string",
                }).pipe((config) => ({
                  userIds: config["User IDs"],
                  userSheetNames: config["User Sheet Names"],
                  userTeams: config["User Teams"],
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
        getEventConfig: (sheetId: string) =>
          pipe(
            sheet.get({
              spreadsheetId: sheetId,
              ranges: ["'Thee's Sheet Settings'!E8:F"],
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
            Effect.Do,
            Effect.bind("sheet", () =>
              sheet.get({
                spreadsheetId: sheetId,
                ranges: [
                  "'Thee's Sheet Settings'!L8:L",
                  "'Thee's Sheet Settings'!M8:M",
                  "'Thee's Sheet Settings'!N8:N",
                ],
              }),
            ),
            Effect.flatMap(({ sheet }) =>
              dayConfigParser(sheet.data.valueRanges),
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
