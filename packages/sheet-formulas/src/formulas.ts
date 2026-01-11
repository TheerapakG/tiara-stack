import {
  Array,
  Chunk,
  Effect,
  HashMap,
  Option,
  Number,
  pipe,
  Schema,
  Match,
  DateTime,
  Duration,
  String,
} from "effect";
import { serverHandlerDataCollection, Schema as SheetSchema } from "sheet-apis";
import { AppsScriptClient } from "typhoon-client-apps-script/client";

const SETTING_SHEET_NAME = "Thee's Sheet Settings";

function getClient(url: string) {
  return AppsScriptClient.create(serverHandlerDataCollection, url);
}

const cellValueValidator = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.DateFromSelf,
);
type CellValue = typeof cellValueValidator.Type;

const calcConfigValidator = Schema.Struct({
  cc: Schema.Boolean,
  considerEnc: Schema.Boolean,
  healNeeded: Schema.Number,
});

function parsePlayers(players: CellValue[][]) {
  return pipe(
    players,
    Schema.decodeUnknown(
      Schema.Array(
        pipe(
          Schema.Tuple(Schema.String, Schema.Boolean),
          Schema.transform(Schema.Struct({ name: Schema.String, encable: Schema.Boolean }), {
            strict: true,
            decode: ([name, encable]) => ({ name, encable }),
            encode: ({ name, encable }) => [name, encable] as const,
          }),
        ),
      ),
    ),
  );
}

function parseFixedTeams(fixedTeams: CellValue[][]) {
  return pipe(
    fixedTeams,
    Schema.decodeUnknown(
      pipe(
        Schema.Array(Schema.Tuple(Schema.String, Schema.Boolean)),
        Schema.transform(
          Schema.Array(Schema.Struct({ name: Schema.String, heal: Schema.Boolean })),
          {
            strict: true,
            decode: Array.map(([name, heal]) => ({ name, heal })),
            encode: Array.map(({ name, heal }) => [name, heal] as const),
          },
        ),
      ),
    ),
  );
}

export function THEECALC(
  _url: string,
  _config: CellValue[][],
  _p1: CellValue[][],
  _p2: CellValue[][],
  _p3: CellValue[][],
  _p4: CellValue[][],
  _p5: CellValue[][],
) {
  return [["The legacy formula-based calc is sunsetted. Use the button menu version instead."]];
}

export function theeCalc(calcSheet: GoogleAppsScript.Spreadsheet.Sheet) {
  return Effect.runSync(
    pipe(
      Effect.all(
        {
          settingSheet: Option.fromNullable(
            SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTING_SHEET_NAME),
          ),
        },
        { concurrency: "unbounded" },
      ),
      Effect.bind("hour", () =>
        pipe(calcSheet.getRange("D23").getValue(), Schema.decodeUnknown(Schema.Number)),
      ),
      Effect.tap(() => calcSheet.getRange(`AX30:CC`).clearContent()),
      Effect.tap(({ hour }) => calcSheet.getRange(`AX30:AY30`).setValues([[hour, "calculating"]])),
      Effect.andThen(({ hour, settingSheet }) =>
        pipe(
          Effect.Do,
          Effect.bind("url", () =>
            pipe(settingSheet.getRange("AI8").getValue(), Schema.decodeUnknown(Schema.String)),
          ),
          Effect.bind("config", () =>
            pipe(
              calcSheet.getRange("U30:V32").getValues(),
              Schema.decodeUnknown(
                Schema.Array(Schema.Tuple(cellValueValidator, cellValueValidator)),
              ),
              Effect.map(HashMap.fromIterable),
              Effect.flatMap((config) =>
                pipe(
                  Effect.Do,
                  Effect.bind("cc", () => HashMap.get(config, "cc")),
                  Effect.bind("considerEnc", () => HashMap.get(config, "consider_enc")),
                  Effect.bind("healNeeded", () => HashMap.get(config, "heal_needed")),
                ),
              ),
              Effect.flatMap(Schema.decodeUnknown(calcConfigValidator)),
            ),
          ),
          Effect.bind("players", () =>
            pipe(
              calcSheet.getRange("AQ30:AR34").getValues(),
              Array.filter(([name]) => name !== ""),
              parsePlayers,
            ),
          ),
          Effect.bind("fixedTeams", () =>
            pipe(
              calcSheet.getRange("AU30:AV45").getValues(),
              Array.filter(([name]) => name !== ""),
              parseFixedTeams,
            ),
          ),
          Effect.tapBoth({
            onFailure: (e) =>
              pipe(
                Effect.logError(e),
                Effect.andThen(() =>
                  calcSheet.getRange(`AX30:AY30`).setValues([[hour, "sheet value error"]]),
                ),
              ),
            onSuccess: ({ url, config, players, fixedTeams }) =>
              pipe(
                Effect.Do,
                Effect.bind("client", () => getClient(url)),
                Effect.tap(() => Effect.log("calc.sheet")),
                Effect.bind("result", ({ client }) =>
                  AppsScriptClient.once(client, "calc.sheet", {
                    sheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
                    config,
                    players,
                    fixedTeams,
                  }),
                ),
                Effect.map(({ result }) =>
                  result.map((r) => [
                    SheetSchema.Room.avgTalent(r),
                    SheetSchema.Room.avgEffectValue(r),
                    ...pipe(
                      r.teams,
                      Chunk.toArray,
                      Array.map((team) => [
                        team.teamName,
                        team.lead,
                        team.backline,
                        SheetSchema.PlayerTeam.getEffectValue(team),
                        team.talent,
                        pipe(team.tags, Array.join(", ")),
                      ]),
                    ).flat(),
                  ]),
                ),
                Effect.tapBoth({
                  onFailure: (e) =>
                    pipe(
                      Effect.logError(e),
                      Effect.andThen(() =>
                        calcSheet.getRange(`AX30:AY30`).setValues([[hour, e.message]]),
                      ),
                    ),
                  onSuccess: (result) =>
                    pipe(
                      Effect.log(result),
                      Effect.andThen(() => calcSheet.getRange(`AX30:AY30`).setValues([[hour, ""]])),
                      Effect.andThen(() =>
                        result.length > 0
                          ? calcSheet.getRange(`AX31:CC${result.length + 30}`).setValues(result)
                          : undefined,
                      ),
                    ),
                }),
              ),
          }),
        ),
      ),
    ),
  );
}

export function copyRange({
  sourceSheet,
  targetSheet,
  rows,
  sourceRowStart,
  sourceColumnStart,
  sourceColumnEnd,
  targetRowStart,
  targetColumnStart,
  targetColumnEnd,
}: {
  sourceSheet: GoogleAppsScript.Spreadsheet.Sheet;
  targetSheet: GoogleAppsScript.Spreadsheet.Sheet;
  rows: number;
  sourceRowStart: number;
  sourceColumnStart: string;
  sourceColumnEnd: string;
  targetRowStart: number;
  targetColumnStart: string;
  targetColumnEnd: string;
}) {
  targetSheet
    .getRange(`${targetColumnStart}${targetRowStart}:${targetColumnEnd}${targetRowStart + rows}`)
    .setValues(
      sourceSheet
        .getRange(
          `${sourceColumnStart}${sourceRowStart}:${sourceColumnEnd}${sourceRowStart + rows}`,
        )
        .getValues(),
    );
}

export function TZSHORTSTAMPS(start: CellValue, tzs: CellValue[][], hours: CellValue[][]) {
  return Effect.runSync(
    pipe(
      Effect.Do,
      Effect.bind("start", () =>
        pipe(
          start,
          Schema.decodeUnknown(
            pipe(
              Schema.Number,
              Schema.transform(Schema.Number, {
                strict: true,
                decode: Number.multiply(1000),
                encode: Number.unsafeDivide(1000),
              }),
              Schema.compose(Schema.DateTimeUtcFromNumber),
            ),
          ),
        ),
      ),
      Effect.bind("tzs", () =>
        pipe(tzs, Array.flatten, Schema.decodeUnknown(Schema.Array(Schema.String))),
      ),
      Effect.bind("hours", () =>
        pipe(hours, Array.flatten, Schema.decodeUnknown(Schema.Array(Schema.Number))),
      ),
      Effect.andThen(({ start, tzs, hours }) =>
        pipe(
          hours,
          Effect.forEach((hour) =>
            pipe(
              Effect.Do,
              Effect.let("startTime", () =>
                pipe(start, DateTime.addDuration(Duration.hours(hour - 1))),
              ),
              Effect.map(({ startTime }) =>
                pipe(
                  tzs,
                  Array.map((tz) =>
                    pipe(
                      Option.Do,
                      Option.bind("startTimeTz", () =>
                        DateTime.makeZoned(startTime, { timeZone: tz }),
                      ),
                      Option.let("startTimeTzHours", ({ startTimeTz }) =>
                        pipe(
                          startTimeTz,
                          DateTime.getPart("hours"),
                          (n) => n.toString(),
                          String.padStart(2, "0"),
                        ),
                      ),
                      Option.let("startTimeTzMinutes", ({ startTimeTz }) =>
                        pipe(
                          startTimeTz,
                          DateTime.getPart("minutes"),
                          (n) => n.toString(),
                          String.padStart(2, "0"),
                        ),
                      ),
                      Option.map(
                        ({ startTimeTzHours, startTimeTzMinutes }) =>
                          `${startTimeTzHours}:${startTimeTzMinutes}`,
                      ),
                      Option.getOrElse(() => ""),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export function TZLONGSTAMPS(start: CellValue, tzs: CellValue[][], hours: CellValue[][]) {
  return Effect.runSync(
    pipe(
      Effect.Do,
      Effect.bind("start", () =>
        pipe(
          start,
          Schema.decodeUnknown(
            pipe(
              Schema.Number,
              Schema.transform(Schema.Number, {
                strict: true,
                decode: Number.multiply(1000),
                encode: Number.unsafeDivide(1000),
              }),
              Schema.compose(Schema.DateTimeUtcFromNumber),
            ),
          ),
        ),
      ),
      Effect.bind("tzs", () =>
        pipe(tzs, Array.flatten, Schema.decodeUnknown(Schema.Array(Schema.String))),
      ),
      Effect.bind("hours", () =>
        pipe(hours, Array.flatten, Schema.decodeUnknown(Schema.Array(Schema.Number))),
      ),
      Effect.andThen(({ start, tzs, hours }) =>
        pipe(
          hours,
          Effect.forEach((hour) =>
            pipe(
              Effect.Do,
              Effect.let("startTime", () =>
                pipe(start, DateTime.addDuration(Duration.hours(hour - 1))),
              ),
              Effect.let("endTime", () => pipe(start, DateTime.addDuration(Duration.hours(hour)))),
              Effect.map(({ startTime, endTime }) =>
                pipe(
                  tzs,
                  Array.map((tz) =>
                    pipe(
                      Option.Do,
                      Option.bind("startTimeTz", () =>
                        DateTime.makeZoned(startTime, { timeZone: tz }),
                      ),
                      Option.bind("endTimeTz", () => DateTime.makeZoned(endTime, { timeZone: tz })),
                      Option.let("startTimeTzHours", ({ startTimeTz }) =>
                        pipe(
                          startTimeTz,
                          DateTime.getPart("hours"),
                          (n) => n.toString(),
                          String.padStart(2, "0"),
                        ),
                      ),
                      Option.let("startTimeTzMinutes", ({ startTimeTz }) =>
                        pipe(
                          startTimeTz,
                          DateTime.getPart("minutes"),
                          (n) => n.toString(),
                          String.padStart(2, "0"),
                        ),
                      ),
                      Option.let("endTimeTzHours", ({ endTimeTz }) =>
                        pipe(
                          endTimeTz,
                          DateTime.getPart("hours"),
                          (n) => n.toString(),
                          String.padStart(2, "0"),
                        ),
                      ),
                      Option.let("endTimeTzMinutes", ({ endTimeTz }) =>
                        pipe(
                          endTimeTz,
                          DateTime.getPart("minutes"),
                          (n) => n.toString(),
                          String.padStart(2, "0"),
                        ),
                      ),
                      Option.map(
                        ({
                          startTimeTzHours,
                          startTimeTzMinutes,
                          endTimeTzHours,
                          endTimeTzMinutes,
                        }) =>
                          `${startTimeTzHours}:${startTimeTzMinutes} - ${endTimeTzHours}:${endTimeTzMinutes}`,
                      ),
                      Option.getOrElse(() => ""),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export function tzLongStamps({
  sheet,
  tzsRow,
  tzsColumnStart,
  tzsColumnEnd,
  hoursColumn,
  hoursRowStart,
  hoursRowEnd,
}: {
  sheet: GoogleAppsScript.Spreadsheet.Sheet;
  tzsRow: number;
  tzsColumnStart: string;
  tzsColumnEnd: string;
  hoursColumn: string;
  hoursRowStart: number;
  hoursRowEnd: number;
}) {
  return Effect.runSync(
    pipe(
      Effect.all(
        {
          settingSheet: Option.fromNullable(
            SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTING_SHEET_NAME),
          ),
        },
        { concurrency: "unbounded" },
      ),
      Effect.bind("start", ({ settingSheet }) =>
        pipe(
          settingSheet.getRange("O8").getValue(),
          Schema.decodeUnknown(
            pipe(
              Schema.Number,
              Schema.transform(Schema.Number, {
                strict: true,
                decode: Number.multiply(1000),
                encode: Number.unsafeDivide(1000),
              }),
              Schema.compose(Schema.DateTimeUtcFromNumber),
            ),
          ),
        ),
      ),
      Effect.bind("tzsLookup", ({ settingSheet }) =>
        pipe(
          settingSheet.getRange("AJ8:AK").getValues(),
          Schema.decodeUnknown(Schema.Array(Schema.Tuple(Schema.String, Schema.String))),
          Effect.map(HashMap.fromIterable),
        ),
      ),
      Effect.bind("tzs", ({ tzsLookup }) =>
        pipe(
          sheet.getRange(`${tzsColumnStart}${tzsRow}:${tzsColumnEnd}${tzsRow}`).getValues(),
          Array.flatten,
          Schema.decodeUnknown(Schema.Array(Schema.String)),
          Effect.map(
            Array.map((tz) =>
              pipe(
                HashMap.get(tzsLookup, tz),
                Option.getOrElse(() => tz),
              ),
            ),
          ),
        ),
      ),
      Effect.bind("hours", () =>
        pipe(
          sheet.getRange(`${hoursColumn}${hoursRowStart}:${hoursColumn}${hoursRowEnd}`).getValues(),
          Array.flatten,
          Schema.decodeUnknown(Schema.Array(Schema.Number)),
        ),
      ),
      Effect.andThen(({ start, tzs, hours }) =>
        Effect.forEach(hours, (hour) =>
          pipe(
            Effect.Do,
            Effect.let("startTime", () =>
              pipe(start, DateTime.addDuration(Duration.hours(hour - 1))),
            ),
            Effect.let("endTime", () => pipe(start, DateTime.addDuration(Duration.hours(hour)))),
            Effect.map(({ startTime, endTime }) =>
              Array.map(tzs, (tz) =>
                pipe(
                  Option.Do,
                  Option.bind("startTimeTz", () => DateTime.makeZoned(startTime, { timeZone: tz })),
                  Option.bind("endTimeTz", () => DateTime.makeZoned(endTime, { timeZone: tz })),
                  Option.let("startTimeTzHours", ({ startTimeTz }) =>
                    pipe(
                      startTimeTz,
                      DateTime.getPart("hours"),
                      (n) => n.toString(),
                      String.padStart(2, "0"),
                    ),
                  ),
                  Option.let("startTimeTzMinutes", ({ startTimeTz }) =>
                    pipe(
                      startTimeTz,
                      DateTime.getPart("minutes"),
                      (n) => n.toString(),
                      String.padStart(2, "0"),
                    ),
                  ),
                  Option.let("endTimeTzHours", ({ endTimeTz }) =>
                    pipe(
                      endTimeTz,
                      DateTime.getPart("hours"),
                      (n) => n.toString(),
                      String.padStart(2, "0"),
                    ),
                  ),
                  Option.let("endTimeTzMinutes", ({ endTimeTz }) =>
                    pipe(
                      endTimeTz,
                      DateTime.getPart("minutes"),
                      (n) => n.toString(),
                      String.padStart(2, "0"),
                    ),
                  ),
                  Option.map(
                    ({ startTimeTzHours, startTimeTzMinutes, endTimeTzHours, endTimeTzMinutes }) =>
                      `${startTimeTzHours}:${startTimeTzMinutes} - ${endTimeTzHours}:${endTimeTzMinutes}`,
                  ),
                  Option.getOrElse(() => ""),
                ),
              ),
            ),
          ),
        ),
      ),
      Effect.andThen((result) =>
        sheet
          .getRange(`${tzsColumnStart}${hoursRowStart}:${tzsColumnEnd}${hoursRowEnd}`)
          .setValues(result),
      ),
    ),
  );
}

export function onEditInstallable(e: GoogleAppsScript.Events.SheetsOnEdit) {
  pipe(
    Match.value({
      template: e.range.getSheet().getRange("A2").getValue(),
      toyaTemplate: e.range.getSheet().getRange("A1").getValue(),
      name: e.range.getSheet().getName(),
      cell: e.range.getA1Notation(),
    }),
    Match.whenOr(
      {
        template: "Template: UniversalTeamCalc v1.17 on TheeCalc v7.0",
        cell: "B27",
      },
      {
        template: "Template: UniversalTeamCalc v1.17 on TheeCalc v8.0",
        cell: "B27",
      },
      () => {
        theeCalc(e.range.getSheet());
      },
    ),
    Match.when(
      {
        toyaTemplate: "Template: Toya Schedule v1.0",
        cell: "D28",
      },
      () => {
        const scheduleSheet = e.range.getSheet();

        tzLongStamps({
          sheet: scheduleSheet,
          tzsRow: 2,
          tzsColumnStart: "D",
          tzsColumnEnd: "H",
          hoursColumn: "J",
          hoursRowStart: 3,
          hoursRowEnd: 26,
        });
      },
    ),
    Match.when(
      {
        template: "Template: Drafter v1.0",
        cell: "S13",
      },
      () => {
        const drafterSheet = e.range.getSheet();
        const rows =
          drafterSheet.getRange("C13").getValue() - drafterSheet.getRange("C12").getValue() + 1;
        const scheduleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
          drafterSheet.getRange("S12").getValue(),
        );

        if (scheduleSheet) {
          copyRange({
            sourceSheet: drafterSheet,
            targetSheet: scheduleSheet,
            rows,
            sourceRowStart: 16,
            sourceColumnStart: "P",
            sourceColumnEnd: "AJ",
            targetRowStart: 11,
            targetColumnStart: "D",
            targetColumnEnd: "X",
          });
        }
      },
    ),
    Match.when(
      {
        template: "Template: Drafter v1.1",
        cell: "S13",
      },
      () => {
        const drafterSheet = e.range.getSheet();
        const rows =
          drafterSheet.getRange("C13").getValue() - drafterSheet.getRange("C12").getValue() + 1;
        const scheduleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
          drafterSheet.getRange("S12").getValue(),
        );

        if (scheduleSheet) {
          copyRange({
            sourceSheet: drafterSheet,
            targetSheet: scheduleSheet,
            rows,
            sourceRowStart: 18,
            sourceColumnStart: "P",
            sourceColumnEnd: "AJ",
            targetRowStart: 13,
            targetColumnStart: "D",
            targetColumnEnd: "X",
          });
        }
      },
    ),
    Match.when(
      {
        template: "Template: Drafter v1.1",
        cell: "S15",
      },
      () => {
        const drafterSheet = e.range.getSheet();
        const rows =
          drafterSheet.getRange("C13").getValue() - drafterSheet.getRange("C12").getValue() + 1;

        tzLongStamps({
          sheet: drafterSheet,
          tzsRow: 18,
          tzsColumnStart: "P",
          tzsColumnEnd: "T",
          hoursColumn: "U",
          hoursRowStart: 19,
          hoursRowEnd: 19 + rows - 1,
        });
      },
    ),
    Match.orElse(() => {}),
  );
}
