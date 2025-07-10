import { type } from "arktype";
import {
  Array,
  Chunk,
  Data,
  Effect,
  Option,
  Order,
  pipe,
  Stream,
} from "effect";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";

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
  roomTeams: Stream.Stream<RoomTeam>,
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
        roomTeams,
        Stream.filter(
          ({ enced, tiererEnced, highestBp }) =>
            enced && !tiererEnced && playerTeam.bp + ENC_BP_DIFF >= highestBp,
        ),
      ),
    ),
    Effect.map(({ healer, filteredRooms }) =>
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
      ),
    ),
  );

const deriveRoomWithEncPlayerTeam = (
  roomTeams: Stream.Stream<RoomTeam>,
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
        roomTeams,
        Stream.filter(
          ({ enced, highestBp }) =>
            enced || (!tierer && playerTeam.bp <= highestBp + ENC_BP_DIFF),
        ),
      ),
    ),
    Effect.map(({ tierer, healer, filteredRooms }) =>
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
      ),
    ),
  );

const deriveRoomWithPlayerTeam = (
  config: { healNeeded: number; considerEnc: boolean },
  roomTeams: Stream.Stream<RoomTeam>,
  playerTeam: PlayerTeam,
) =>
  pipe(
    Effect.Do,
    Effect.bindAll(() => ({
      tierer: Effect.succeed(playerTeam.tags.includes("tierer")),
      encable: Effect.succeed(playerTeam.tags.includes("encable")),
    })),
    Effect.flatMap(({ tierer, encable }) =>
      pipe(
        roomTeams,
        Stream.broadcast(2, { capacity: "unbounded" }),
        Effect.flatMap(([roomTeamsForNormal, roomTeamsForEnc]) =>
          pipe(
            Effect.Do,
            Effect.bind("normalStream", () =>
              deriveRoomWithNormalPlayerTeam(roomTeamsForNormal, playerTeam),
            ),
            Effect.bind("encStream", () =>
              (encable || tierer) && config.considerEnc
                ? deriveRoomWithEncPlayerTeam(roomTeamsForEnc, playerTeam)
                : Effect.succeed(Stream.empty),
            ),
            Effect.map(({ normalStream, encStream }) =>
              Stream.merge(normalStream, encStream),
            ),
          ),
        ),
      ),
    ),
  );

const deriveRoomWithPlayerTeams = (
  config: { healNeeded: number; considerEnc: boolean },
  roomTeams: Stream.Stream<RoomTeam>,
  playerTeams: PlayerTeam[],
) =>
  pipe(
    roomTeams,
    Stream.broadcast(playerTeams.length, { capacity: "unbounded" }),
    Effect.flatMap((roomTeamsArr) =>
      Effect.forEach(
        Array.zip(roomTeamsArr, playerTeams),
        ([roomTeams, playerTeam]) =>
          deriveRoomWithPlayerTeam(config, roomTeams, playerTeam),
      ),
    ),
    Effect.map((streams) =>
      Stream.mergeAll(streams, { concurrency: "unbounded" }),
    ),
  );

const sortTeams = (teams: Chunk.Chunk<RoomTeam>) =>
  pipe(teams, Chunk.sort(RoomTeam.order));

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
        Effect.forEach(player, (player) => PlayerTeam.fromApiObject(player)),
      ),
    ),
    Effect.bind("filteredPlayerTeams", ({ playerTeams }) =>
      Effect.forEach(playerTeams, (playerTeam) => filterFixedTeams(playerTeam)),
    ),
    Effect.bind("result", ({ filteredPlayerTeams }) =>
      pipe(
        Effect.reduce(
          filteredPlayerTeams,
          Stream.make(
            new RoomTeam({
              enced: false,
              tiererEnced: false,
              healed: 0,
              highestBp: 0,
              bp: 0,
              percent: 0,
              room: [],
            }),
          ),
          (roomTeams, playerTeams) =>
            deriveRoomWithPlayerTeams(config, roomTeams, playerTeams),
        ),
        Effect.flatMap(Stream.runCollect),
      ),
    ),
    Effect.let("sortedResult", ({ result }) => sortTeams(result)),
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
  );

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

export const calcHandler = defineHandlerBuilder()
  .config(calcHandlerConfig)
  .handler(
    Effect.gen(function* () {
      const { config, players } =
        yield* Event.withConfig(calcHandlerConfig).request.parsed();
      yield* Effect.log(config, players);
      const result = Chunk.toArray(yield* calc(config, players));
      yield* Effect.log(result);
      return result;
    }),
  );
