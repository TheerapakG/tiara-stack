import { Array, Chunk, Effect, HashMap, HashSet, Layer, Option, pipe } from "effect";
import type { Rpc, RpcGroup } from "effect/unstable/rpc";
import { CalcRpcs } from "sheet-ingress-api/sheet-apis-rpc";
import { CalcConfig, CalcService, PlayerService } from "@/services";
import { PlayerTeam } from "sheet-ingress-api/schemas/sheet";
import { Room } from "sheet-ingress-api/schemas/sheet/room";
import { Array as ArrayUtils } from "typhoon-core/utils";

type CalcRpc<Tag extends RpcGroup.Rpcs<typeof CalcRpcs>["_tag"]> = Extract<
  RpcGroup.Rpcs<typeof CalcRpcs>,
  { readonly _tag: Tag }
>;

type CalcBotPayload = Rpc.Payload<CalcRpc<"calc.calcBot">>;
type CalcSheetPayload = Rpc.Payload<CalcRpc<"calc.calcSheet">>;

export const calcLayer = CalcRpcs.toLayer(
  Effect.gen(function* () {
    const calcService = yield* CalcService;
    const playerService = yield* PlayerService;

    return {
      "calc.calcBot": Effect.fnUntraced(function* ({ payload }: CalcBotPayload) {
        const config = new CalcConfig(payload.config);
        const playerTeams = yield* Effect.forEach(payload.players, (player) =>
          Effect.succeed(Array.getSomes(player.map((team) => PlayerTeam.fromTeam(false, team)))),
        );
        const rooms = yield* calcService.calc(config, playerTeams);

        return Chunk.toArray(
          Chunk.map(rooms, (room) => ({
            averageTalent: Room.avgTalent(room),
            averageEffectValue: Room.avgEffectValue(room),
            room: Chunk.toArray(
              Chunk.map(room.teams, (team) => ({
                type: team.type,
                team: team.teamName,
                talent: team.talent,
                effectValue: PlayerTeam.getEffectValue(team),
                tags: Array.fromIterable(team.tags),
              })),
            ),
          })),
        );
      }),
      "calc.calcSheet": Effect.fnUntraced(function* ({ payload }: CalcSheetPayload) {
        const config = new CalcConfig(payload.config);
        const fixedTeams = pipe(
          payload.fixedTeams,
          ArrayUtils.Collect.toHashMapByKey("name"),
          HashMap.map(({ heal }) =>
            pipe(
              HashSet.make("fixed"),
              HashSet.union(heal ? HashSet.make("heal") : HashSet.empty()),
            ),
          ),
        );
        const playerTeams = yield* Effect.forEach(
          payload.players,
          Effect.fnUntraced(function* (player) {
            const teams = yield* playerService.getTeamsByNames(payload.sheetId, [player.name]);

            return Array.getSomes(
              teams.map((team) =>
                pipe(
                  PlayerTeam.fromTeam(payload.config.cc, team),
                  Option.map((playerTeam) =>
                    PlayerTeam.addTags(
                      pipe(
                        HashSet.empty<string>(),
                        HashSet.union(player.encable ? HashSet.make("encable") : HashSet.empty()),
                        HashSet.union(
                          pipe(
                            Option.flatMap(team.teamName, (teamName) =>
                              HashMap.get(fixedTeams, teamName),
                            ),
                            Option.getOrElse(() => HashSet.empty<string>()),
                          ),
                        ),
                      ),
                    )(playerTeam),
                  ),
                ),
              ),
            );
          }),
        );
        const rooms = yield* calcService.calc(config, playerTeams);
        return Chunk.toArray(rooms);
      }),
    };
  }),
).pipe(Layer.provide([CalcService.layer, PlayerService.layer]));
