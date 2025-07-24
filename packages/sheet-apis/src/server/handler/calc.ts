import { Chunk, Data, Effect, Option, Order, pipe, Stream } from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import * as v from "valibot";

const ENC_BP_DIFF = 0;

class PlayerTeam extends Data.TaggedClass("PlayerTeam")<{
  type: string;
  team: string;
  bp: number;
  percent: number;
  tags: string[];
}> {
  static addTags(tags: string[]) {
    return (playerTeam: PlayerTeam) =>
      new PlayerTeam({
        ...playerTeam,
        tags: [...playerTeam.tags, ...tags],
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
        tags: apiObject.tagStr.split(/\s*,\s*/).filter(Boolean),
      }),
    );
  }
}

const filterFixedTeams = (playerTeams: PlayerTeam[]) =>
  pipe(
    Effect.Do,
    Effect.let("fixedTeams", () =>
      playerTeams
        .filter(({ tags }) => tags.includes("fixed"))
        .map((playerTeam) =>
          playerTeam.tags.includes("tierer_hint")
            ? PlayerTeam.addTags(["tierer"])(playerTeam)
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
  room: PlayerTeam[];
}> {
  static byBp = Order.mapInput(Order.number, ({ bp }: RoomTeam) => bp);
  static byPercent = Order.mapInput(
    Order.number,
    ({ percent }: RoomTeam) => percent,
  );
  static order = Order.combine(RoomTeam.byBp, RoomTeam.byPercent);
}

const deriveRoomWithNormalPlayerTeam = (
  roomTeams: Chunk.Chunk<RoomTeam>,
  playerTeam: PlayerTeam,
) =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => ({
      tierer: Effect.succeed(playerTeam.tags.includes("tierer")),
      healer: Effect.succeed(playerTeam.tags.includes("heal")),
      encable: Effect.succeed(playerTeam.tags.includes("encable")),
    })),
    Effect.let("filteredRooms", () =>
      pipe(
        Stream.fromIterable(roomTeams),
        Stream.filter(
          ({ enced, tiererEnced, highestBp }) =>
            !enced || tiererEnced || playerTeam.bp + ENC_BP_DIFF < highestBp,
        ),
      ),
    ),
    Effect.flatMap(({ healer, filteredRooms }) =>
      pipe(
        filteredRooms,
        Stream.map(
          ({ enced, tiererEnced, healed, highestBp, bp, percent, room }) =>
            new RoomTeam({
              enced,
              tiererEnced,
              healed: healed + (healer ? 1 : 0),
              highestBp: Math.max(highestBp, playerTeam.bp),
              bp: bp + playerTeam.bp,
              percent: percent + playerTeam.percent,
              room: [...room, playerTeam],
            }),
        ),
        Stream.runCollect,
      ),
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
    Effect.bindAll(() => ({
      tierer: Effect.succeed(playerTeam.tags.includes("tierer")),
      healer: Effect.succeed(playerTeam.tags.includes("heal")),
    })),
    Effect.let("filteredRooms", ({ tierer }) =>
      pipe(
        Stream.fromIterable(roomTeams),
        Stream.filter(
          ({ enced, highestBp }) =>
            !enced && (tierer || playerTeam.bp > highestBp + ENC_BP_DIFF),
        ),
      ),
    ),
    Effect.flatMap(({ tierer, healer, filteredRooms }) =>
      pipe(
        filteredRooms,
        Stream.map(
          ({ healed, highestBp, bp, percent, room }) =>
            new RoomTeam({
              enced: true,
              tiererEnced: tierer,
              healed: healed + (healer ? 1 : 0),
              highestBp: Math.max(highestBp, bp),
              bp: bp + playerTeam.bp,
              percent: percent + 2 * playerTeam.percent,
              room: [
                ...room,
                PlayerTeam.addTags([
                  ...playerTeam.tags,
                  tierer ? "tierer_enc_override" : "enc",
                ])(playerTeam),
              ],
            }),
        ),
        Stream.runCollect,
      ),
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
    Effect.tap(() => Effect.log("Deriving room with player team", playerTeam)),
    Effect.bindAll(() => ({
      tierer: Effect.succeed(playerTeam.tags.includes("tierer")),
      encable: Effect.succeed(playerTeam.tags.includes("encable")),
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
              room: [],
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
          room,
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
