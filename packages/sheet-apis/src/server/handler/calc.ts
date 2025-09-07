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
import { Computed, computed } from "typhoon-core/signal";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import * as v from "valibot";
import { GuildConfigService } from "../../services";

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
  static order = Order.combine(
    RoomTeam.byBp,
    Order.reverse(RoomTeam.byPercent),
  );

  static base(teams: ReadonlyArray<PlayerTeam>) {
    return new RoomTeam({
      enced: false,
      tiererEnced: false,
      healed: teams.reduce(
        (acc, t) => acc + (HashSet.has(t.tags, "heal") ? 1 : 0),
        0,
      ),
      highestBp: teams.reduce((acc, t) => Math.max(acc, t.bp), 0),
      bp: teams.reduce((acc, t) => acc + t.bp, 0),
      percent: teams.reduce((acc, t) => acc + t.percent, 0),
      room: Chunk.fromIterable(teams.map((t) => PlayerTeam.clone(t))),
    });
  }

  static applyEncAndDoormat = (roomTeam: RoomTeam) => {
    const teams = Chunk.toArray(roomTeam.room);

    let encIndex = -1;
    let bestPercent = -Infinity;
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];
      if (HashSet.has(t.tags, "encable")) {
        if (t.percent > bestPercent) {
          bestPercent = t.percent;
          encIndex = i;
        }
      }
    }

    let tiererOverride = false;
    if (encIndex === -1) {
      let bestBp = -Infinity;
      for (let i = 0; i < teams.length; i++) {
        const t = teams[i];
        if (HashSet.has(t.tags, "tierer")) {
          if (t.bp > bestBp) {
            bestBp = t.bp;
            encIndex = i;
            tiererOverride = true;
          }
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

    return new RoomTeam({
      enced: true,
      tiererEnced: tiererOverride,
      healed: roomTeam.healed,
      highestBp: roomTeam.highestBp,
      bp: roomTeam.bp,
      percent: roomTeam.percent + encTeam.percent,
      room: Chunk.fromIterable(updatedTeams),
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
  (config: { healNeeded: number; considerEnc: boolean }) =>
  (perPlayerTeams: Array.NonEmptyReadonlyArray<ReadonlyArray<PlayerTeam>>) =>
    pipe(
      Effect.succeed(
        cartesian(perPlayerTeams).map((teams) =>
          pipe(
            RoomTeam.base(teams),
            config.considerEnc
              ? RoomTeam.applyEncAndDoormat
              : Function.identity,
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

const filterConfigTeams = (
  config: { healNeeded: number; considerEnc: boolean },
  teams: Chunk.Chunk<RoomTeam>,
) =>
  pipe(
    teams,
    Chunk.filter(({ healed }) => healed >= config.healNeeded),
    Effect.succeed,
    Effect.withSpan("filterHealTeams", { captureStackTrace: true }),
  );

const sortTeams = (teams: Chunk.Chunk<RoomTeam>) =>
  pipe(
    teams,
    Chunk.sort(RoomTeam.order),
    Effect.succeed,
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
        filteredPlayerTeams,
        Array.match({
          onEmpty: () => Effect.succeed(Chunk.empty()),
          onNonEmpty: deriveRoomsFromCartesian(config),
        }),
      ),
    ),
    Effect.bind("configResult", ({ result }) =>
      filterConfigTeams(config, result),
    ),
    Effect.bind("sortedResult", ({ configResult }) => sortTeams(configResult)),
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

const getUserAgent = <E, R>(request: Computed<Request, E, R>) =>
  computed(
    pipe(
      request,
      Effect.map(({ headers }) => headers.get("user-agent") ?? ""),
      Effect.withSpan("getUserAgent", { captureStackTrace: true }),
    ),
  );

const extractGoogleAppsScriptId = <E, R>(userAgent: Computed<string, E, R>) =>
  computed(
    pipe(
      userAgent,
      Effect.map((userAgent) =>
        userAgent.match(/Google-Apps-Script.*?id:\s*([^\s)]+)/i),
      ),
      Effect.map(Option.fromNullable),
      Effect.map(Option.flatMap(Array.get(1))),
      Effect.flatMap(
        Option.match({
          onSome: (id) => Effect.succeed(id),
          onNone: () =>
            Effect.fail({
              message:
                "this does not seem like a request from an apps script... what are you doing here?",
            }),
        }),
      ),
      Effect.withSpan("extractGoogleAppsScriptId", { captureStackTrace: true }),
    ),
  );

const getGuildConfigByScriptId = <E, R>(scriptId: Computed<string, E, R>) =>
  computed(
    pipe(
      scriptId,
      Effect.flatMap(GuildConfigService.getGuildConfigWithBoundScript),
      Effect.flatMap((computed) => computed),
      Effect.flatMap(Array.head),
      Effect.flipWith((effect) =>
        pipe(
          effect,
          Effect.tap(() => Effect.log("unregistered script id")),
          Effect.map(() => ({
            message:
              "unregistered sheet... contact me before yoinking the sheet, could you?",
          })),
        ),
      ),
      Effect.withSpan("guildConfig", { captureStackTrace: true }),
    ),
  );

export const calcHandler = defineHandlerBuilder()
  .config(calcHandlerConfig)
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("request", () => Event.webRequest()),
      Effect.bind("userAgent", ({ request }) => getUserAgent(request)),
      Effect.bind("googleAppsScriptId", ({ userAgent }) =>
        extractGoogleAppsScriptId(userAgent),
      ),
      Effect.bind("guildConfig", ({ googleAppsScriptId }) =>
        pipe(
          getGuildConfigByScriptId(googleAppsScriptId),
          Computed.annotateLogs("scriptId", googleAppsScriptId),
          Computed.annotateSpans("scriptId", googleAppsScriptId),
        ),
      ),
      Effect.bind("parsed", ({ googleAppsScriptId }) =>
        pipe(
          Event.withConfig(calcHandlerConfig).request.parsed(),
          Computed.annotateLogs("scriptId", googleAppsScriptId),
          Computed.annotateSpans("scriptId", googleAppsScriptId),
        ),
      ),
      Effect.flatMap(({ guildConfig, parsed, googleAppsScriptId }) =>
        pipe(
          computed(
            pipe(
              Effect.Do,
              Effect.bind("guildConfig", () => guildConfig),
              Effect.bind("parsed", () => parsed),
              Effect.flatMap(({ parsed: { config, players } }) =>
                calc(config, players),
              ),
              Effect.map(Chunk.toArray),
            ),
          ),
          Computed.annotateLogs("scriptId", googleAppsScriptId),
          Computed.annotateSpans("scriptId", googleAppsScriptId),
        ),
      ),
      Effect.withSpan("calcHandler", { captureStackTrace: true }),
    ),
  );
