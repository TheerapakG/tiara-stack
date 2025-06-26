import { type } from "arktype";
import { Effect, pipe } from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event, Server } from "typhoon-server/server";

const ENC_BP_DIFF = 0;

const calcTeamsByConfigMap = (
  config: { healNeeded: number; considerEnc: boolean },
  players: {
    type: string;
    tagStr: string;
    player: string;
    team: string;
    lead: number;
    backline: number;
    bp: "" | number;
    percent: number;
  }[][],
) => {
  console.log(config);

  let currentRooms = [
    {
      enced: false,
      tiererEnced: false,
      healed: 0,
      highestBp: 0,
      bp: 0,
      percent: 0,
      room: [] as Array<{
        type: string;
        team: string;
        bp: number;
        percent: number;
        tags: string[];
      }>,
    },
  ];

  for (const player of players) {
    const newRooms = [];

    let playerTeams = player
      .map(({ type, tagStr, team, bp, percent }) => {
        const tags = tagStr.split(/\s*,\s*/).filter(Boolean);

        return {
          type,
          team,
          bp,
          percent: percent ?? 1,
          tags,
        };
      })
      .filter(({ team, bp }) => team !== "" && bp !== "")
      .map(({ bp, ...data }) => ({
        ...data,
        bp: bp as number,
      }));

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

    for (const { type, team, bp, percent, tags } of playerTeams) {
      const tierer = tags.includes("tierer");
      const healer = tags.includes("heal");
      const encable = tags.includes("encable");

      // Nothing
      for (const {
        enced,
        tiererEnced,
        healed,
        highestBp,
        bp: prevBp,
        percent: prevPercent,
        room,
      } of currentRooms) {
        if (enced && !tiererEnced && bp + ENC_BP_DIFF >= highestBp) {
          continue;
        }
        newRooms.push({
          enced,
          tiererEnced,
          healed: healed + (healer ? 1 : 0),
          highestBp: Math.max(highestBp, bp),
          bp: prevBp + bp,
          percent: prevPercent + percent,
          room: [...room, { type, team, bp, percent, tags: [...tags] }],
        });
      }

      // Enc
      if ((encable || tierer) && config.considerEnc) {
        for (const {
          enced,
          healed,
          highestBp,
          bp: prevBp,
          percent: prevPercent,
          room,
        } of currentRooms) {
          if ((enced || !tierer) && bp <= highestBp + ENC_BP_DIFF) {
            continue;
          }
          newRooms.push({
            enced: true,
            tiererEnced: tierer,
            healed: healed + (healer ? 1 : 0),
            highestBp: Math.max(highestBp, bp),
            bp: prevBp + bp,
            percent: prevPercent + 2 * percent,
            room: [
              ...room,
              {
                type,
                team,
                bp,
                percent,
                tags: [...tags, tierer ? "tierer_enc_override" : "enc"],
              },
            ],
          });
        }
      }
    }
    console.log(newRooms.length);

    currentRooms = newRooms;
  }

  const result = currentRooms.filter(
    ({ enced, healed }) =>
      (config.considerEnc ? enced : true) && healed >= config.healNeeded,
  );

  console.log(result.length);

  result.sort(
    ({ bp: bpA, percent: percentA }, { bp: bpB, percent: percentB }) =>
      bpA - bpB !== 0 ? bpA - bpB : percentB - percentA,
  );

  return result;
};

const calc = (
  config: {
    healNeeded: number;
    considerEnc: boolean;
  },
  players: {
    type: string;
    tagStr: string;
    player: string;
    team: string;
    lead: number;
    backline: number;
    bp: "" | number;
    percent: number;
  }[][],
) => {
  // return ["unregistered sheet... contact me before yoinking the sheet could you?"]

  const result = calcTeamsByConfigMap(config, players);

  const bestResult = [];
  let bestPercent = 0;
  for (const { bp, percent, room } of result) {
    if (percent > bestPercent) {
      bestPercent = percent;
      bestResult.push({
        averageBp: bp / 5,
        averagePercent: percent / 5,
        room,
      });
    }
  }

  bestResult.reverse();

  return bestResult;
};

const calcHandlerConfig = defineHandlerConfigBuilder()
  .name("calc")
  .type("subscription")
  .request({
    validator: type({
      config: {
        healNeeded: "number",
        considerEnc: "boolean",
      },
      players: type({
        type: "string",
        tagStr: "string",
        player: "string",
        team: "string",
        lead: "number",
        backline: "number",
        bp: "number | ''",
        percent: "number",
      })
        .array()
        .array()
        .exactlyLength(5),
    }),
    validate: true,
  })
  .response({
    validator: type({
      averageBp: "number",
      averagePercent: "number",
      room: type({
        type: "string",
        team: "string",
        bp: "number",
        percent: "number",
        tags: "string[]",
      }).array(),
    }).array(),
  })
  .build();

const calcHandler = defineHandlerBuilder()
  .config(calcHandlerConfig)
  .handler(
    Effect.gen(function* () {
      const { config, players } =
        yield* Event.withConfig(calcHandlerConfig).request.parsed();
      return calc(config, players);
    }),
  );

export const server = pipe(
  Server.create(),
  Effect.map(Server.add(calcHandler)),
);
