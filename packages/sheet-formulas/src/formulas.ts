import { Effect, HashMap, pipe } from "effect";
import { serverHandlerConfigGroup } from "sheet-apis";
import { AppsScriptClient } from "typhoon-client-apps-script/client";
import { validate } from "typhoon-core/validator";
import * as v from "valibot";

function getClient(url: string) {
  return AppsScriptClient.create(serverHandlerConfigGroup, url);
}

const cellValueValidator = v.union([
  v.string(),
  v.number(),
  v.boolean(),
  v.date(),
]);
type CellValue = v.InferOutput<typeof cellValueValidator>;

const configValidator = v.object({
  healNeeded: v.number(),
  considerEnc: v.boolean(),
});

const playerTeamValidator = v.object({
  type: v.string(),
  tagStr: v.string(),
  player: v.string(),
  team: v.string(),
  lead: v.number(),
  backline: v.number(),
  bp: v.union([v.number(), v.literal("")]),
  percent: v.number(),
});

function parsePlayerTeam([
  type,
  tagStr,
  player,
  team,
  lead,
  backline,
  bp,
  percent,
]: CellValue[]) {
  return validate(playerTeamValidator)({
    type,
    tagStr,
    player,
    team,
    lead,
    backline,
    bp,
    percent,
  });
}

function parsePlayer(player: CellValue[][]) {
  return pipe(player, Effect.forEach(parsePlayerTeam));
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
          validate(v.array(v.tuple([cellValueValidator, cellValueValidator]))),
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
          Effect.flatMap(validate(configValidator)),
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
