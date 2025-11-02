import { PlayerTeam, Room } from "@/server/schema";
import { regex } from "arkregex";
import {
  Array,
  Chunk,
  Data,
  Effect,
  Function,
  HashSet,
  Option,
  pipe,
  Stream,
} from "effect";

export class CalcConfig extends Data.TaggedClass("CalcConfig")<{
  healNeeded: number;
  considerEnc: boolean;
}> {}

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

const baseRoom = (teams: ReadonlyArray<PlayerTeam>) => {
  return new Room({
    enced: false,
    tiererEnced: false,
    healed: pipe(
      teams,
      Array.reduce(0, (acc, t) => acc + (HashSet.has(t.tags, "heal") ? 1 : 0)),
    ),
    talent: pipe(
      teams,
      Array.reduce(0, (acc, t) => acc + t.talent),
    ),
    effectValue: pipe(
      teams,
      Array.reduce(0, (acc, t) => acc + PlayerTeam.getEffectValue(t)),
    ),
    teams: Chunk.fromIterable(teams),
  });
};

const applyRoomEncAndDoormat = (roomTeam: Room) => {
  const teams = Chunk.toArray(roomTeam.teams);

  const tiererTalent = pipe(
    teams,
    Array.filter((t) => HashSet.has(t.tags, "tierer")),
    Array.match({
      onEmpty: () => 0,
      onNonEmpty: (self) => Array.max(self, PlayerTeam.byTalent).talent,
    }),
  );

  let encIndex = -1;
  let bestEffectValue = -Infinity;
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    if (
      HashSet.has(t.tags, "encable") &&
      PlayerTeam.getEffectValue(t) > bestEffectValue &&
      t.talent > tiererTalent
    ) {
      bestEffectValue = PlayerTeam.getEffectValue(t);
      encIndex = i;
    }
  }

  let tiererOverride = false;
  if (encIndex === -1) {
    let bestTalent = -Infinity;
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];
      if (HashSet.has(t.tags, "tierer") && t.talent > bestTalent) {
        bestTalent = t.talent;
        encIndex = i;
        tiererOverride = true;
      }
    }
  }

  if (encIndex === -1) {
    return roomTeam;
  }

  const encTeam = teams[encIndex];
  const updatedTeams = teams.map((t, i) => {
    if (i === encIndex) {
      return PlayerTeam.addTags(
        HashSet.make(tiererOverride ? "tierer_enc_override" : "enc"),
      )(t);
    }
    return t.talent > encTeam.talent && !HashSet.has(t.tags, "tierer")
      ? PlayerTeam.addTags(HashSet.make("doormat"))(t)
      : t;
  });

  return new Room({
    enced: true,
    tiererEnced: tiererOverride,
    healed: roomTeam.healed,
    talent: roomTeam.talent,
    effectValue: roomTeam.effectValue + PlayerTeam.getEffectValue(encTeam),
    teams: Chunk.fromIterable(updatedTeams),
  });
};

const cartesianHeadTeams = (teams: ReadonlyArray<PlayerTeam>) =>
  pipe(
    teams,
    Array.match({
      onEmpty: () =>
        Array.make(
          new PlayerTeam({
            type: "Placeholder",
            playerName: "Placeholder",
            teamName: "Placeholder",
            lead: 0,
            backline: 0,
            talent: 0,
            tags: HashSet.make("placeholder"),
          }),
        ),
      onNonEmpty: (self) => self,
    }),
  );

const playerNameRegex = regex("^(?<name>.*?)(?:\\s+(?:e(?:nc)?))?$");

const cartesianTeams = (
  playerTeams: Array.NonEmptyReadonlyArray<ReadonlyArray<PlayerTeam>>,
): readonly PlayerTeam[][] =>
  pipe(
    playerTeams,
    Array.tailNonEmpty,
    Array.match({
      onEmpty: () =>
        pipe(
          Array.headNonEmpty(playerTeams),
          cartesianHeadTeams,
          Array.map((headTeam) => Array.make(headTeam)),
        ),
      onNonEmpty: (self) =>
        pipe(
          cartesianTeams(self),
          Array.flatMap((product) =>
            pipe(
              Array.headNonEmpty(playerTeams),
              cartesianHeadTeams,
              (headTeams) =>
                pipe(
                  headTeams,
                  Array.map((headTeam) => Array.make(headTeam)),
                  Array.map(Array.appendAll(product)),
                  Array.filter(
                    (teams) =>
                      Array.length(teams) ===
                      HashSet.size(
                        HashSet.fromIterable(
                          pipe(
                            teams,
                            Array.map(
                              (t) =>
                                playerNameRegex.exec(t.playerName)?.groups
                                  ?.name ?? "",
                            ),
                          ),
                        ),
                      ),
                  ),
                  Array.match({
                    onEmpty: () =>
                      pipe(
                        Array.make(
                          new PlayerTeam({
                            type: "Placeholder",
                            playerName:
                              playerNameRegex.exec(
                                Array.headNonEmpty(headTeams).playerName,
                              )?.groups?.name ?? "",
                            teamName: `${playerNameRegex.exec(Array.headNonEmpty(headTeams).playerName)?.groups?.name ?? ""} | placeholder`,
                            lead: 0,
                            backline: 0,
                            talent: 0,
                            tags: HashSet.make("placeholder"),
                          }),
                        ),
                        Array.appendAll(product),
                        Array.make,
                      ),
                    onNonEmpty: (self) => self,
                  }),
                ),
            ),
          ),
        ),
    }),
  );

const deriveRoomsFromCartesian =
  (config: CalcConfig) =>
  (playerTeams: Array.NonEmptyReadonlyArray<ReadonlyArray<PlayerTeam>>) =>
    pipe(
      Effect.succeed(cartesianTeams(playerTeams)),
      Effect.map(
        Array.map((teams) =>
          pipe(
            baseRoom(teams),
            config.considerEnc ? applyRoomEncAndDoormat : Function.identity,
          ),
        ),
      ),
      Effect.map(Chunk.fromIterable),
      Effect.tap((derived) =>
        Effect.log(
          `Derived ${Chunk.size(derived)} rooms from cartesian product`,
        ),
      ),
      Effect.withSpan("deriveRoomsFromCartesian", { captureStackTrace: true }),
    );

const filterConfigRooms = (config: CalcConfig) => (rooms: Chunk.Chunk<Room>) =>
  pipe(
    rooms,
    Chunk.filter(({ healed }) => healed >= config.healNeeded),
    Effect.succeed,
    Effect.withSpan("filterConfigRooms", { captureStackTrace: true }),
  );

const filterBestRooms = (rooms: Chunk.Chunk<Room>) =>
  pipe(
    Stream.fromIterable(rooms),
    Stream.mapAccum(0, (bestEffectValue, room) => [
      Math.max(bestEffectValue, room.effectValue),
      room.effectValue > bestEffectValue ? Option.some(room) : Option.none(),
    ]),
    Stream.filter(Option.isSome),
    Stream.map(({ value }) => value),
    Stream.runCollect,
    Effect.withSpan("filterBestRooms", { captureStackTrace: true }),
  );

export class CalcService extends Effect.Service<CalcService>()("CalcService", {
  succeed: {
    calc: (config: CalcConfig, playerTeams: PlayerTeam[][]) =>
      pipe(
        Effect.forEach(playerTeams, filterFixedTeams),
        Effect.flatMap(
          Array.match({
            onEmpty: () => Effect.succeed(Chunk.empty()),
            onNonEmpty: deriveRoomsFromCartesian(config),
          }),
        ),
        Effect.flatMap(filterConfigRooms(config)),
        Effect.map(Chunk.sort(Room.Order)),
        Effect.flatMap(filterBestRooms),
        Effect.map(Chunk.reverse),
        Effect.withSpan("CalcService.calc", { captureStackTrace: true }),
      ),
  },
  accessors: true,
}) {}
