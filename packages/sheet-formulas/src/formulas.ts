import { Array, Chunk, Effect, HashMap, Option, pipe, Schema } from "effect";
import {
  serverHandlerConfigCollection,
  Schema as SheetSchema,
} from "sheet-apis";
import { AppsScriptClient } from "typhoon-client-apps-script/client";

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
  healNeeded: Schema.Number,
  considerEnc: Schema.Boolean,
});

const calc2ConfigValidator = Schema.Struct({
  cc: Schema.Boolean,
  considerEnc: Schema.Boolean,
  healNeeded: Schema.Number,
});

const playerTeamValidator = pipe(
  Schema.Tuple(
    Schema.String,
    Schema.String,
    Schema.String,
    Schema.String,
    Schema.Number,
    Schema.Number,
    Schema.Union(Schema.Number, Schema.Literal("")),
    Schema.Number,
  ),
  Schema.transform(
    Schema.Struct({
      type: Schema.String,
      tagStr: Schema.String,
      player: Schema.String,
      team: Schema.String,
      lead: Schema.Number,
      backline: Schema.Number,
      talent: Schema.Union(Schema.Number, Schema.Literal("")),
      effectValue: Schema.Number,
    }),
    {
      strict: true,
      decode: ([
        type,
        tagStr,
        player,
        team,
        lead,
        backline,
        talent,
        effectValue,
      ]) => ({
        type,
        tagStr,
        player,
        team,
        lead,
        backline,
        talent,
        effectValue,
      }),
      encode: ({
        type,
        tagStr,
        player,
        team,
        lead,
        backline,
        talent,
        effectValue,
      }) =>
        [
          type,
          tagStr,
          player,
          team,
          lead,
          backline,
          talent,
          effectValue,
        ] as const,
    },
  ),
);

function parsePlayerTeam(player: CellValue[][]) {
  return pipe(player, Schema.decodeUnknown(Schema.Array(playerTeamValidator)));
}

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
  url: string,
  config: CellValue[][],
  p1: CellValue[][],
  p2: CellValue[][],
  p3: CellValue[][],
  p4: CellValue[][],
  p5: CellValue[][],
) {
  return Effect.runSync(
    pipe(
      Effect.Do,
      Effect.bind("config", () =>
        pipe(
          config,
          Schema.decodeUnknown(
            Schema.Array(Schema.Tuple(cellValueValidator, cellValueValidator)),
          ),
          Effect.map(HashMap.fromIterable),
          Effect.flatMap((config) =>
            pipe(
              Effect.Do,
              Effect.bind("healNeeded", () =>
                HashMap.get(config, "heal_needed"),
              ),
              Effect.bind("considerEnc", () =>
                HashMap.get(config, "consider_enc"),
              ),
            ),
          ),
          Effect.flatMap(Schema.decodeUnknown(calcConfigValidator)),
        ),
      ),
      Effect.bind("players", () =>
        pipe([p1, p2, p3, p4, p5], Effect.forEach(parsePlayerTeam)),
      ),
      Effect.catchAll((e) =>
        pipe(
          Effect.logError(e),
          Effect.andThen(() => Effect.fail({ message: "sheet value error" })),
        ),
      ),
      Effect.bind("client", () => getClient(url)),
      Effect.bind("result", ({ client, config, players }) =>
        AppsScriptClient.once(client, "calc", {
          config,
          players,
        }),
      ),
      Effect.tap(({ result }) => Effect.log(result)),
      Effect.map(({ result }) =>
        result.map((r) => [
          "",
          r.averageTalent,
          r.averageEffectValue,
          ...r.room.map((r) => [r.tags.join(", "), r.team]).flat(),
        ]),
      ),
      Effect.catchAll((e) =>
        pipe(
          Effect.logError(e),
          Effect.andThen(() => Effect.succeed([[e.message]])),
        ),
      ),
      Effect.tap((result) => Effect.log(result)),
    ),
  );
}

export function THEECALC2() {
  return Effect.runSync(
    pipe(
      Effect.Do,
      Effect.bindAll(
        () => ({
          settingSheet: Option.fromNullable(
            SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
              "Thee's Sheet Settings",
            ),
          ),
          calcSheet: Option.fromNullable(
            SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
              "Thee's Calc v1.16",
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
              Effect.flatMap(Schema.decodeUnknown(calc2ConfigValidator)),
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
