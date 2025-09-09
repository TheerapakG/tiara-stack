import {
  Array,
  Chunk,
  Data,
  Effect,
  Function,
  HashSet,
  Option,
  Order,
  pipe,
  Stream,
} from "effect";

export class CalcConfig extends Data.TaggedClass("CalcConfig")<{
  healNeeded: number;
  considerEnc: boolean;
}> {}

export class PlayerTeam extends Data.TaggedClass("PlayerTeam")<{
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

  static clone(playerTeam: PlayerTeam) {
    return PlayerTeam.addTags(HashSet.empty())(playerTeam);
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

class Room extends Data.TaggedClass("Room")<{
  enced: boolean;
  tiererEnced: boolean;
  healed: number;
  bp: number;
  percent: number;
  teams: Chunk.Chunk<PlayerTeam>;
}> {
  static byBp = Order.mapInput(Order.number, ({ bp }: Room) => bp);
  static byPercent = Order.mapInput(
    Order.number,
    ({ percent }: Room) => percent,
  );
  static Order = Order.combine(Room.byBp, Order.reverse(Room.byPercent));

  static base(teams: ReadonlyArray<PlayerTeam>) {
    return new Room({
      enced: false,
      tiererEnced: false,
      healed: pipe(
        teams,
        Array.reduce(
          0,
          (acc, t) => acc + (HashSet.has(t.tags, "heal") ? 1 : 0),
        ),
      ),
      bp: pipe(
        teams,
        Array.reduce(0, (acc, t) => acc + t.bp),
      ),
      percent: pipe(
        teams,
        Array.reduce(0, (acc, t) => acc + t.percent),
      ),
      teams: Chunk.fromIterable(
        pipe(
          teams,
          Array.map((t) => PlayerTeam.clone(t)),
        ),
      ),
    });
  }

  static applyEncAndDoormat = (roomTeam: Room) => {
    const teams = Chunk.toArray(roomTeam.teams);

    let encIndex = -1;
    let bestPercent = -Infinity;
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];
      if (HashSet.has(t.tags, "encable") && t.percent > bestPercent) {
        bestPercent = t.percent;
        encIndex = i;
      }
    }

    let tiererOverride = false;
    if (encIndex === -1) {
      let bestBp = -Infinity;
      for (let i = 0; i < teams.length; i++) {
        const t = teams[i];
        if (HashSet.has(t.tags, "tierer") && t.bp > bestBp) {
          bestBp = t.bp;
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
      return t.bp > encTeam.bp
        ? PlayerTeam.addTags(HashSet.make("doormat"))(t)
        : t;
    });

    return new Room({
      enced: true,
      tiererEnced: tiererOverride,
      healed: roomTeam.healed,
      bp: roomTeam.bp,
      percent: roomTeam.percent + encTeam.percent,
      teams: Chunk.fromIterable(updatedTeams),
    });
  };
}

const cartesian = <T>(
  arrays: Array.NonEmptyReadonlyArray<ReadonlyArray<T>>,
): T[][] =>
  pipe(
    arrays,
    Array.tailNonEmpty,
    Array.match({
      onEmpty: () =>
        pipe(
          Array.headNonEmpty(arrays),
          Array.map((head) => Array.make(head)),
        ),
      onNonEmpty: (self) =>
        pipe(
          cartesian(self),
          Array.flatMap((product) =>
            pipe(
              Array.headNonEmpty(arrays),
              Array.map((head) => [head, ...product]),
            ),
          ),
        ),
    }),
  );

const deriveRoomsFromCartesian =
  (config: CalcConfig) =>
  (playerTeams: Array.NonEmptyReadonlyArray<ReadonlyArray<PlayerTeam>>) =>
    pipe(
      Effect.succeed(
        cartesian(playerTeams).map((teams) =>
          pipe(
            Room.base(teams),
            config.considerEnc ? Room.applyEncAndDoormat : Function.identity,
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
    Stream.mapAccum(0, (bestPercent, room) => [
      Math.max(bestPercent, room.percent),
      room.percent > bestPercent ? Option.some(room) : Option.none(),
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
        Effect.forEach(playerTeams, (playerTeam) =>
          filterFixedTeams(playerTeam),
        ),
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
