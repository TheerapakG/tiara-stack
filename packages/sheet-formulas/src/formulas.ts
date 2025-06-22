/* eslint-disable @typescript-eslint/no-unused-vars */
import "../polyfill/classPolyfill";

import { Effect, pipe } from "effect";
import type { server } from "sheet-apis/server";
import { AppsScriptClient } from "typhoon-client-apps-script/client";

const ENC_BP_DIFF = 0;

function getClient() {
  return AppsScriptClient.create<Effect.Effect.Success<typeof server>>(
    "https://sheet.theerapakg.moe",
  );
}

/**
 * @preserve
 * Calculate All Teams With Specified ConfigMap
 */
function calcTeamsByConfigMap(
  configMap: { heal_needed: number; consider_enc: boolean },
  players: Array<
    Array<[string, string, string, string, number, number, number, number]>
  >,
) {
  console.log(configMap);

  let currentTeams = [
    {
      enced: false,
      tiererEnced: false,
      healed: 0,
      highestBp: 0,
      bp: 0,
      percent: 0,
      team: [] as Array<{
        type: string;
        name: string;
        bp: number;
        percent: number;
        tags: string[];
      }>,
    },
  ];

  for (const player of players) {
    const newTeams = [];

    let playerTeams = player
      .map(([type, tagStr, _1, name, _2, _3, bp, percent]) => {
        const tags = tagStr.split(/\s*,\s*/).filter(Boolean);

        return {
          type,
          name,
          bp,
          percent: percent ?? 1,
          tags,
        };
      })
      // @ts-expect-error bp is not always a number
      .filter(({ name, bp }) => name !== "" && bp !== "");

    const playerFixedTeams = playerTeams.filter(({ tags }) =>
      tags.includes("fixed"),
    );
    if (playerFixedTeams.length > 0) {
      playerTeams = playerFixedTeams.map(({ tags, ...data }) => {
        return {
          ...data,
          tags: [...tags, ...(tags.includes("tierer_hint") ? ["tierer"] : [])],
        };
      });
    }

    for (const { type, name, bp, percent, tags } of playerTeams) {
      const tierer = tags.includes("tierer");
      const healer = tags.includes("heal");
      const encable = tags.includes("encable");
      console.log({ tierer, healer, encable });

      // Nothing
      for (const {
        enced,
        tiererEnced,
        healed,
        highestBp,
        bp: prevBp,
        percent: prevPercent,
        team,
      } of currentTeams) {
        if (enced && !tiererEnced && bp + ENC_BP_DIFF >= highestBp) {
          continue;
        }
        newTeams.push({
          enced,
          tiererEnced,
          healed: healed + (healer ? 1 : 0),
          highestBp: Math.max(highestBp, bp),
          bp: prevBp + bp,
          percent: prevPercent + percent,
          team: [...team, { type, name, bp, percent, tags: [...tags] }],
        });
      }

      // Enc
      if ((encable || tierer) && configMap["consider_enc"]) {
        for (const {
          enced,
          tiererEnced,
          healed,
          highestBp,
          bp: prevBp,
          percent: prevPercent,
          team,
        } of currentTeams) {
          if ((enced || !tierer) && bp <= highestBp + ENC_BP_DIFF) {
            continue;
          }
          newTeams.push({
            enced: true,
            tiererEnced: tierer,
            healed: healed + (healer ? 1 : 0),
            highestBp: Math.max(highestBp, bp),
            bp: prevBp + bp,
            percent: prevPercent + 2 * percent,
            team: [
              ...team,
              {
                type,
                name,
                bp,
                percent,
                tags: [...tags, tierer ? "tierer_enc_override" : "enc"],
              },
            ],
          });
        }
      }
    }
    console.log(
      newTeams.length,
      newTeams.filter(
        ({ enced, healed }) =>
          (configMap["consider_enc"] ? enced : true) &&
          healed >= configMap["heal_needed"],
      ).length,
    );

    currentTeams = newTeams;
  }

  const result = currentTeams.filter(
    ({ enced, healed }) =>
      (configMap["consider_enc"] ? enced : true) &&
      healed >= configMap["heal_needed"],
  );

  result.sort(
    ({ bp: bpA, percent: percentA }, { bp: bpB, percent: percentB }) =>
      bpA - bpB !== 0 ? bpA - bpB : percentB - percentA,
  );

  return result;
}

/**
 * @preserve
 * Calculate Some Top Teams
 *
 * @customfunction
 */
function THEECALC(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Array<[string, any]>,
  p1: Array<[string, string, string, string, number, number, number, number]>,
  p2: Array<[string, string, string, string, number, number, number, number]>,
  p3: Array<[string, string, string, string, number, number, number, number]>,
  p4: Array<[string, string, string, string, number, number, number, number]>,
  p5: Array<[string, string, string, string, number, number, number, number]>,
) {
  // return ["unregistered sheet... contact me before yoinking the sheet could you?"]
  const configMap = Object.fromEntries(config);
  console.log(configMap);

  const players = [p1, p2, p3, p4, p5];

  const result = calcTeamsByConfigMap(
    configMap as { heal_needed: number; consider_enc: boolean },
    players,
  );

  const bestResult = [];
  let bestPercent = 0;
  for (const { bp, percent, team } of result) {
    if (percent > bestPercent) {
      bestPercent = percent;
      bestResult.push([
        bp / 5,
        percent / 5,
        ...team.map(({ name, tags }) => [tags.join(", "), name]).flat(),
      ]);
    }
  }

  bestResult.reverse();

  return bestResult.map((r) => ["", ...r]);
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
function THEECALC2(
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
      getClient(),
      Effect.flatMap((client) =>
        AppsScriptClient.once(client, "calc", {
          config: {
            healNeeded: configMap["heal_needed"],
            considerEnc: configMap["consider_enc"],
          },
          players: [
            parsePlayer(p1),
            parsePlayer(p2),
            parsePlayer(p3),
            parsePlayer(p4),
            parsePlayer(p5),
          ],
        }),
      ),
    ),
  );
}
