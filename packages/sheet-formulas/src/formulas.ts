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
  const configMap = Object.fromEntries(config);

  return Effect.runSync(
    pipe(
      getClient(url),
      Effect.flatMap((client) =>
        AppsScriptClient.once(client, "calc", {
          config: {
            healNeeded: configMap["heal_needed"],
            considerEnc: configMap["consider_enc"],
          },
          players: [p1, p2, p3, p4, p5].map(parsePlayer),
        }),
      ),
    ),
  );
}
