import {
  Chunk,
  Data,
  Effect,
  HashSet,
  Option,
  Order,
  pipe,
  Stream,
} from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import * as v from "valibot";

const ENC_BP_DIFF = 0;

class PlayerTeam extends Data.TaggedClass("PlayerTeam")<{
  type: string;
  team: string;
  bp: number;
  percent: number;
  tags: HashSet.HashSet<string>;
}> {
  static addTags(tags: HashSet.HashSet<string>) {
    return (playerTeam: PlayerTeam) =>
      new PlayerTeam({
        type: playerTeam.type,
        team: playerTeam.team,
        bp: playerTeam.bp,
        percent: playerTeam.percent,
        tags: HashSet.union(playerTeam.tags, tags),
      });
  }

  static fromApiObject(apiObject: {
    type: string;
    tagStr: string;
    player: string;
    team: string;
    lead: number;
    backline: number;
    bp: "" | number;
    percent: number;
  }) {
    if (apiObject.team === "" || apiObject.bp === "") return Option.none();

    return Option.some(
      new PlayerTeam({
        type: apiObject.type,
        team: apiObject.team,
        bp: apiObject.bp,
        percent: apiObject.percent ?? 1,
        tags: HashSet.fromIterable(
          apiObject.tagStr.split(/\s*,\s*/).filter(Boolean),
        ),
      }),
    );
  }

  static clone(playerTeam: PlayerTeam) {
    return new PlayerTeam({
      type: playerTeam.type,
      team: playerTeam.team,
      bp: playerTeam.bp,
      percent: playerTeam.percent,
      tags: HashSet.union(playerTeam.tags, HashSet.empty()),
    });
  }
}

const filterFixedTeams = (playerTeams: PlayerTeam[]) =>
  pipe(
    Effect.Do,
    Effect.let("fixedTeams", () =>
      playerTeams
        .filter(({ tags }) => HashSet.has(tags, "fixed"))
        .map((playerTeam) =>
          HashSet.has(playerTeam.tags, "tierer_hint")
            ? PlayerTeam.addTags(HashSet.make("tierer"))(playerTeam)
            : playerTeam,
        ),
    ),
    Effect.map(({ fixedTeams }) =>
      fixedTeams.length > 0 ? fixedTeams : playerTeams,
    ),
  );

class RoomTeam extends Data.TaggedClass("RoomTeam")<{
  enced: boolean;
  tiererEnced: boolean;
  healed: number;
  highestBp: number;
  bp: number;
  percent: number;
  room: Chunk.Chunk<PlayerTeam>;
}> {
  static byBp = Order.mapInput(Order.number, ({ bp }: RoomTeam) => bp);
  static byPercent = Order.mapInput(
    Order.number,
    ({ percent }: RoomTeam) => percent,
  );
  static order = Order.combine(RoomTeam.byBp, RoomTeam.byPercent);

  static addPlayer(playerTeam: PlayerTeam, enc: boolean) {
    return (roomTeam: RoomTeam) =>
      pipe(
        Effect.Do,
        Effect.let("tierer", () => HashSet.has(playerTeam.tags, "tierer")),
        Effect.let("heal", () => HashSet.has(playerTeam.tags, "heal")),
        Effect.tap(() => Effect.log("Adding player to room", playerTeam)),
        Effect.map(
          ({ tierer, heal }) =>
            new RoomTeam({
              enced: enc ? true : roomTeam.enced,
              tiererEnced: enc ? tierer : roomTeam.tiererEnced,
              healed: roomTeam.healed + (heal ? 1 : 0),
              highestBp: Math.max(roomTeam.highestBp, playerTeam.bp),
              bp: roomTeam.bp + playerTeam.bp,
              percent: roomTeam.percent + (enc ? 2 : 1) * playerTeam.percent,
              room: Chunk.append(
                Chunk.fromIterable(roomTeam.room),
                enc
                  ? PlayerTeam.addTags(
                      HashSet.make(tierer ? "tierer_enc_override" : "enc"),
                    )(playerTeam)
                  : PlayerTeam.clone(playerTeam),
              ),
            }),
        ),
      );
  }
}

const deriveRoomWithNormalPlayerTeam = (
  roomTeams: Chunk.Chunk<RoomTeam>,
  playerTeam: PlayerTeam,
) =>
  pipe(
    Effect.Do,
    Effect.tap(() =>
      Effect.log("Deriving room with normal player team", roomTeams),
    ),
    Effect.flatMap(() =>
      pipe(
        roomTeams,
        Chunk.filter(
          ({ enced, tiererEnced, highestBp }) =>
            !enced || tiererEnced || playerTeam.bp + ENC_BP_DIFF < highestBp,
        ),
        Effect.forEach(RoomTeam.addPlayer(playerTeam, false)),
        Effect.map(Chunk.fromIterable),
      ),
    ),
    Effect.tap((derivedRooms) =>
      Effect.log("Derived room with normal player team", derivedRooms),
    ),
    Effect.tap((derivedRooms) =>
      Effect.log(
        `Derived ${Chunk.size(derivedRooms)} rooms with normal player team`,
      ),
    ),
    Effect.withSpan("deriveRoomWithNormalPlayerTeam", {
      captureStackTrace: true,
    }),
  );

const deriveRoomWithEncPlayerTeam = (
  roomTeams: Chunk.Chunk<RoomTeam>,
  playerTeam: PlayerTeam,
) =>
  pipe(
    Effect.Do,
    Effect.let("tierer", () => HashSet.has(playerTeam.tags, "tierer")),
    Effect.tap(() =>
      Effect.log("Deriving room with enc player team", roomTeams),
    ),
    Effect.flatMap(({ tierer }) =>
      pipe(
        roomTeams,
        Chunk.filter(
          ({ enced, highestBp }) =>
            !enced && (tierer || playerTeam.bp > highestBp + ENC_BP_DIFF),
        ),
        Effect.forEach(RoomTeam.addPlayer(playerTeam, true)),
        Effect.map(Chunk.fromIterable),
      ),
    ),
    Effect.tap((derivedRooms) =>
      Effect.log("Derived room with enc player team", derivedRooms),
    ),
    Effect.tap((derivedRooms) =>
      Effect.log(
        `Derived ${Chunk.size(derivedRooms)} rooms with enc player team`,
      ),
    ),
    Effect.withSpan("deriveRoomWithEncPlayerTeam", { captureStackTrace: true }),
  );

const deriveRoomWithPlayerTeam = (
  config: { healNeeded: number; considerEnc: boolean },
  roomTeams: Chunk.Chunk<RoomTeam>,
  playerTeam: PlayerTeam,
) =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => ({
      tierer: Effect.succeed(HashSet.has(playerTeam.tags, "tierer")),
      encable: Effect.succeed(HashSet.has(playerTeam.tags, "encable")),
    })),
    Effect.flatMap(({ tierer, encable }) =>
      pipe(
        Effect.Do,
        Effect.bind("normalChunk", () =>
          deriveRoomWithNormalPlayerTeam(roomTeams, playerTeam),
        ),
        Effect.bind("encChunk", () =>
          (encable || tierer) && config.considerEnc
            ? deriveRoomWithEncPlayerTeam(roomTeams, playerTeam)
            : Effect.succeed(Chunk.empty()),
        ),
        Effect.map(({ normalChunk, encChunk }) =>
          Chunk.appendAll(normalChunk, encChunk),
        ),
      ),
    ),
    Effect.withSpan("deriveRoomWithPlayerTeam", { captureStackTrace: true }),
  );

const deriveRoomWithPlayerTeams = (
  config: { healNeeded: number; considerEnc: boolean },
  roomTeams: Chunk.Chunk<RoomTeam>,
  playerTeams: PlayerTeam[],
) =>
  pipe(
    Effect.forEach(playerTeams, (playerTeam, i) =>
      pipe(
        deriveRoomWithPlayerTeam(config, roomTeams, playerTeam),
        Effect.annotateLogs("playerTeam", playerTeam),
        Effect.annotateLogs("teamIndex", i + 1),
      ),
    ),
    Effect.map((chunks) => Chunk.flatten(Chunk.fromIterable(chunks))),
    Effect.tap((derivedRooms) =>
      Effect.log(`Derived ${Chunk.size(derivedRooms)} rooms`),
    ),
    Effect.withSpan("deriveRoomWithPlayerTeams", { captureStackTrace: true }),
  );

const sortTeams = (teams: Chunk.Chunk<RoomTeam>) =>
  pipe(
    Effect.succeed(teams),
    Effect.map(Chunk.sort(RoomTeam.order)),
    Effect.withSpan("sortTeams", { captureStackTrace: true }),
  );

const filterBestTeams = (teams: Chunk.Chunk<RoomTeam>) =>
  pipe(
    Stream.fromIterable(teams),
    Stream.mapAccum(0, (bestPercent, { bp, percent, room }) => [
      Math.max(bestPercent, percent),
      percent > bestPercent
        ? Option.some({
            bp,
            percent,
            room,
          })
        : Option.none(),
    ]),
    Stream.filter(Option.isSome),
    Stream.map(({ value }) => value),
    Stream.runCollect,
    Effect.withSpan("filterBestTeams", { captureStackTrace: true }),
  );

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
) =>
  pipe(
    Effect.Do,
    Effect.bind("playerTeams", () =>
      Effect.forEach(players, (player) =>
        Effect.allSuccesses(
          player.map((team) => PlayerTeam.fromApiObject(team)),
        ),
      ),
    ),
    Effect.bind("filteredPlayerTeams", ({ playerTeams }) =>
      Effect.forEach(playerTeams, (playerTeam) => filterFixedTeams(playerTeam)),
    ),
    Effect.bind("result", ({ filteredPlayerTeams }) =>
      pipe(
        Effect.reduce(
          filteredPlayerTeams,
          Chunk.of(
            new RoomTeam({
              enced: false,
              tiererEnced: false,
              healed: 0,
              highestBp: 0,
              bp: 0,
              percent: 0,
              room: Chunk.empty(),
            }),
          ) as Chunk.Chunk<RoomTeam>,
          (roomTeams, playerTeams, i) =>
            pipe(
              deriveRoomWithPlayerTeams(config, roomTeams, playerTeams),
              Effect.annotateLogs("playerIndex", i + 1),
            ),
        ),
      ),
    ),
    Effect.bind("sortedResult", ({ result }) => sortTeams(result)),
    Effect.bind("bestResult", ({ sortedResult }) =>
      filterBestTeams(sortedResult),
    ),
    Effect.map(({ bestResult }) =>
      pipe(
        bestResult,
        Chunk.map(({ bp, percent, room }) => ({
          averageBp: bp / 5,
          averagePercent: percent / 5,
          room: pipe(
            room,
            Chunk.map(({ type, team, bp, percent, tags }) => ({
              type,
              team,
              bp,
              percent,
              tags: HashSet.toValues(tags),
            })),
            Chunk.toArray,
          ),
        })),
        Chunk.reverse,
      ),
    ),
    Effect.withSpan("calc", { captureStackTrace: true }),
  );

const calcHandlerConfig = defineHandlerConfigBuilder()
  .name("calc")
  .type("subscription")
  .request({
    validator: v.object({
      config: v.object({
        healNeeded: v.number(),
        considerEnc: v.boolean(),
      }),
      players: v.pipe(
        v.array(
          v.array(
            v.object({
              type: v.string(),
              tagStr: v.string(),
              player: v.string(),
              team: v.string(),
              lead: v.number(),
              backline: v.number(),
              bp: v.union([v.number(), v.literal("")]),
              percent: v.number(),
            }),
          ),
        ),
        v.length(5),
      ),
    }),
    validate: true,
  })
  .response({
    validator: v.array(
      v.object({
        averageBp: v.number(),
        averagePercent: v.number(),
        room: v.array(
          v.object({
            type: v.string(),
            team: v.string(),
            bp: v.number(),
            percent: v.number(),
            tags: v.array(v.string()),
          }),
        ),
      }),
    ),
  })
  .build();

export const calcHandler = defineHandlerBuilder()
  .config(calcHandlerConfig)
  .handler(
    pipe(
      Event.withConfig(calcHandlerConfig).request.parsed(),
      Effect.flatMap(({ config, players }) => calc(config, players)),
      Effect.map(Chunk.toArray),
      Effect.withSpan("calcHandler", { captureStackTrace: true }),
    ),
  );
