import { Effect, HashMap, pipe, Schema } from "effect";
import { serverHandlerConfigCollection } from "sheet-apis";
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

const configValidator = Schema.Struct({
  healNeeded: Schema.Number,
  considerEnc: Schema.Boolean,
});

const playerTeamValidator = Schema.Struct({
  type: Schema.String,
  tagStr: Schema.String,
  player: Schema.String,
  team: Schema.String,
  lead: Schema.Number,
  backline: Schema.Number,
  bp: Schema.Union(Schema.Number, Schema.Literal("")),
  percent: Schema.Number,
});

function parsePlayer(player: CellValue[][]) {
  return pipe(
    player,
    Effect.forEach((player) =>
      pipe(player, Schema.decodeUnknown(playerTeamValidator)),
    ),
  );
}

function parsePlayerNames(playerNames: CellValue[][]) {
  return pipe(
    playerNames,
    Effect.forEach((playerName) =>
      pipe(playerName, Schema.decodeUnknown(Schema.String)),
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
          Effect.flatMap(Schema.decodeUnknown(configValidator)),
        ),
      ),
      Effect.bind("players", () =>
        pipe([p1, p2, p3, p4, p5], Effect.forEach(parsePlayer)),
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
          r.averageBp,
          r.averagePercent,
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

export function THEECALC2(
  url: string,
  config: CellValue[][],
  players: CellValue[][],
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
          Effect.flatMap(Schema.decodeUnknown(configValidator)),
        ),
      ),
      Effect.bind("players", () => parsePlayerNames(players)),
      Effect.catchAll((e) =>
        pipe(
          Effect.logError(e),
          Effect.andThen(() => Effect.fail({ message: "sheet value error" })),
        ),
      ),
      Effect.bind("client", () => getClient(url)),
      Effect.bind("result", ({ client, config, players }) =>
        AppsScriptClient.once(client, "calc.sheet", {
          sheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
          config,
          players,
        }),
      ),
      Effect.tap(({ result }) => Effect.log(result)),
      Effect.map(({ result }) =>
        result.map((r) => [
          "",
          r.averageBp,
          r.averagePercent,
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
