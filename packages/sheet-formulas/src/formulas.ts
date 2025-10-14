import {
  Array,
  Chunk,
  Effect,
  HashMap,
  Option,
  pipe,
  Schema,
  Match,
} from "effect";
import {
  serverHandlerConfigCollection,
  Schema as SheetSchema,
} from "sheet-apis";
import { AppsScriptClient } from "typhoon-client-apps-script/client";

const SETTING_SHEET_NAME = "Thee's Sheet Settings";
const CALC_SHEET_NAME = "Thee's Calc v1.16";

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
  return Effect.succeed([
    [
      "The legacy formula-based calc is sunsetted. Use the button menu version instead.",
    ],
  ]);
}

export function THEECALC2() {
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
          calcSheet: Option.fromNullable(
            SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
              CALC_SHEET_NAME,
            ),
          ),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.tap(({ calcSheet }) =>
        calcSheet.getRange(`AX30:CD`).clearContent(),
      ),
      Effect.andThen(({ settingSheet, calcSheet }) =>
        pipe(
          Effect.Do,
          Effect.bind("url", () =>
            pipe(
              settingSheet.getRange("AG8").getValue(),
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
                  calcSheet.getRange(`AX30`).setValue("sheet value error"),
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
                    "",
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
                        calcSheet.getRange(`AX30`).setValue(e.message),
                      ),
                    ),
                  onSuccess: (result) =>
                    pipe(
                      Effect.log(result),
                      Effect.andThen(() =>
                        calcSheet
                          .getRange(`AX30:CD${result.length + 29}`)
                          .setValues(result),
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

export function onEditInstallable(e: GoogleAppsScript.Events.SheetsOnEdit) {
  pipe(
    Match.value({
      name: e.range.getSheet().getName(),
      cell: e.range.getA1Notation(),
    }),
    Match.when({ name: CALC_SHEET_NAME, cell: "B27" }, () => {
      THEECALC2();
    }),
    Match.orElse(() => {}),
  );
}
