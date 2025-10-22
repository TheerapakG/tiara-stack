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
import {
  serverHandlerConfigCollection,
  Schema as SheetSchema,
} from "sheet-apis";
import { AppsScriptClient } from "typhoon-client-apps-script/client";

const SETTING_SHEET_NAME = "Thee's Sheet Settings";

function getClient(url: string) {
  return AppsScriptClient.create(serverHandlerConfigCollection, url);
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
          Schema.transform(
            Schema.Struct({ name: Schema.String, encable: Schema.Boolean }),
            {
              strict: true,
              decode: ([name, encable]) => ({ name, encable }),
              encode: ({ name, encable }) => [name, encable] as const,
            },
          ),
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
          Schema.Array(
            Schema.Struct({ name: Schema.String, heal: Schema.Boolean }),
          ),
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
  return [
    [
      "The legacy formula-based calc is sunsetted. Use the button menu version instead.",
    ],
  ];
}

export function THEECALC2(calcSheet: GoogleAppsScript.Spreadsheet.Sheet) {
  return Effect.runSync(
    pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          settingSheet: Option.fromNullable(
            SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
              SETTING_SHEET_NAME,
            ),
          ),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.bind("hour", () =>
        pipe(
          calcSheet.getRange("D23").getValue(),
          Schema.decodeUnknown(Schema.Number),
        ),
      ),
      Effect.tap(() => calcSheet.getRange(`AX30:CC`).clearContent()),
      Effect.tap(({ hour }) =>
        calcSheet.getRange(`AX30:AY30`).setValues([[hour, "calculating"]]),
      ),
      Effect.andThen(({ hour, settingSheet }) =>
        pipe(
          Effect.Do,
          Effect.bind("url", () =>
            pipe(
              settingSheet.getRange("AH8").getValue(),
              Schema.decodeUnknown(Schema.String),
            ),
          ),
          Effect.bind("config", () =>
            pipe(
              calcSheet.getRange("U30:V32").getValues(),
              Schema.decodeUnknown(
                Schema.Array(
                  Schema.Tuple(cellValueValidator, cellValueValidator),
                ),
              ),
              Effect.map(HashMap.fromIterable),
              Effect.flatMap((config) =>
                pipe(
                  Effect.Do,
                  Effect.bind("cc", () => HashMap.get(config, "cc")),
                  Effect.bind("considerEnc", () =>
                    HashMap.get(config, "consider_enc"),
                  ),
                  Effect.bind("healNeeded", () =>
                    HashMap.get(config, "heal_needed"),
                  ),
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
                  calcSheet
                    .getRange(`AX30:AY30`)
                    .setValues([[hour, "sheet value error"]]),
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
                        team.team,
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
                        calcSheet
                          .getRange(`AX30:AY30`)
                          .setValues([[hour, e.message]]),
                      ),
                    ),
                  onSuccess: (result) =>
                    pipe(
                      Effect.log(result),
                      Effect.andThen(() =>
                        calcSheet.getRange(`AX30:AY30`).setValues([[hour, ""]]),
                      ),
                      Effect.andThen(() =>
                        result.length > 0
                          ? calcSheet
                              .getRange(`AX31:CC${result.length + 30}`)
                              .setValues(result)
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

export function TZSHORTSTAMPS(
  start: CellValue,
  tzs: CellValue[][],
  hours: CellValue[][],
) {
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
        pipe(
          tzs,
          Array.flatten,
          Schema.decodeUnknown(Schema.Array(Schema.String)),
        ),
      ),
      Effect.bind("hours", () =>
        pipe(
          hours,
          Array.flatten,
          Schema.decodeUnknown(Schema.Array(Schema.Number)),
        ),
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

export function TZLONGSTAMPS(
  start: CellValue,
  tzs: CellValue[][],
  hours: CellValue[][],
) {
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
        pipe(
          tzs,
          Array.flatten,
          Schema.decodeUnknown(Schema.Array(Schema.String)),
        ),
      ),
      Effect.bind("hours", () =>
        pipe(
          hours,
          Array.flatten,
          Schema.decodeUnknown(Schema.Array(Schema.Number)),
        ),
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
              Effect.let("endTime", () =>
                pipe(start, DateTime.addDuration(Duration.hours(hour))),
              ),
              Effect.map(({ startTime, endTime }) =>
                pipe(
                  tzs,
                  Array.map((tz) =>
                    pipe(
                      Option.Do,
                      Option.bind("startTimeTz", () =>
                        DateTime.makeZoned(startTime, { timeZone: tz }),
                      ),
                      Option.bind("endTimeTz", () =>
                        DateTime.makeZoned(endTime, { timeZone: tz }),
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

export function onEditInstallable(e: GoogleAppsScript.Events.SheetsOnEdit) {
  pipe(
    Match.value({
      template: e.range.getSheet().getRange("A2").getValue(),
      name: e.range.getSheet().getName(),
      cell: e.range.getA1Notation(),
    }),
    Match.when(
      {
        template: "Template: UniversalTeamCalc v1.16 on TheeCalc v7.0",
        cell: "B27",
      },
      () => {
        THEECALC2(e.range.getSheet());
      },
    ),
    Match.when(
      {
        template: "Template: Drafter v1.0",
        cell: "S13",
      },
      () => {
        const sheet = e.range.getSheet();
        const rows =
          sheet.getRange("C13").getValue() -
          sheet.getRange("C12").getValue() +
          1;
        const targetSheet =
          SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
            sheet.getRange("S12").getValue(),
          );
        targetSheet
          ?.getRange(`D11:X${rows + 11}`)
          .setValues(sheet.getRange(`P16:AJ${rows + 16}`).getValues());
      },
    ),
    Match.orElse(() => {}),
  );
}
