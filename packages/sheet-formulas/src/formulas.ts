/* eslint-disable @typescript-eslint/no-unused-vars */
import "../polyfill/classPolyfill";

import { Effect, pipe } from "effect";
import type { Server } from "sheet-apis";
import { AppsScriptClient } from "typhoon-client-apps-script/client";

function getClient(url: string) {
  return AppsScriptClient.create<Server>(url);
}

function parsePlayer(
  player: Array<
    [string, string, string, string, number, number, number | "", number]
  >,
) {
  return player.map(
    ([type, tagStr, player, team, lead, backline, bp, percent]) => ({
      type,
      tagStr,
      player,
      team,
      lead,
      backline,
      bp,
      percent,
    }),
  );
}

/**
 * @preserve
 * Calculate Some Top Teams
 *
 * @customfunction
 */
function THEECALC(
  url: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Array<[string, any]>,
  p1: Array<
    [string, string, string, string, number, number, number | "", number]
  >,
  p2: Array<
    [string, string, string, string, number, number, number | "", number]
  >,
  p3: Array<
    [string, string, string, string, number, number, number | "", number]
  >,
  p4: Array<
    [string, string, string, string, number, number, number | "", number]
  >,
  p5: Array<
    [string, string, string, string, number, number, number | "", number]
  >,
) {
  return Effect.runSync(
    pipe(
      Effect.Do,
      Effect.let("config", () => Object.fromEntries(config)),
      Effect.bind("client", () => getClient(url)),
      Effect.bind("result", ({ client, config }) =>
        AppsScriptClient.once(client, "calc", {
          config: {
            healNeeded: config["heal_needed"],
            considerEnc: config["consider_enc"],
          },
          players: [p1, p2, p3, p4, p5].map(parsePlayer),
        }),
      ),
      Effect.map(({ result }) => {
        return result.map((r) => [
          "",
          r.averageBp,
          r.averagePercent,
          ...r.room.map((r) => [r.tags.join(", "), r.team]).flat(),
        ]);
      }),
      Effect.catchAll((e) => {
        return Effect.succeed([[e.message]]);
      }),
    ),
  );
}
