import { HttpApiBuilder } from "@effect/platform";
import { Array, Chunk, Effect, HashMap, HashSet, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { CalcConfig, CalcService } from "@/services/calc";
import { PlayerTeam, Team } from "@/schemas/sheet";
import { Room } from "@/schemas/sheet/room";
import { PlayerService } from "@/services/player";
import { Array as ArrayUtils } from "typhoon-core/utils";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";

export const CalcLive = HttpApiBuilder.group(Api, "calc", (handlers) =>
  pipe(
    Effect.all({
      calcService: CalcService,
      playerService: PlayerService,
    }),
    Effect.map(({ calcService, playerService }) =>
      handlers
        .handle("calcBot", ({ payload }) =>
          pipe(
            Effect.Do,
            Effect.let("config", () => new CalcConfig(payload.config)),
            Effect.bind("playerTeams", () =>
              Effect.forEach(payload.players, (player) =>
                Effect.allSuccesses(player.map((team: Team) => PlayerTeam.fromTeam(false, team))),
              ),
            ),
            Effect.flatMap(({ config, playerTeams }) => calcService.calc(config, playerTeams)),
            Effect.map(
              Chunk.map((room) => ({
                averageTalent: Room.avgTalent(room),
                averageEffectValue: Room.avgEffectValue(room),
                room: pipe(
                  room.teams,
                  Chunk.map((team) => ({
                    type: team.type,
                    team: team.teamName,
                    talent: team.talent,
                    effectValue: PlayerTeam.getEffectValue(team),
                    tags: HashSet.toValues(team.tags),
                  })),
                  Chunk.toArray,
                ),
              })),
            ),
            Effect.map(Chunk.toArray),
          ),
        )
        .handle("calcSheet", ({ payload }) =>
          pipe(
            Effect.Do,
            Effect.let("config", () => new CalcConfig(payload.config)),
            Effect.let("fixedTeams", () =>
              pipe(
                payload.fixedTeams,
                ArrayUtils.Collect.toHashMapByKey("name"),
                HashMap.map(({ heal }) =>
                  pipe(
                    HashSet.make("fixed"),
                    HashSet.union(heal ? HashSet.make("heal") : HashSet.empty()),
                  ),
                ),
              ),
            ),
            Effect.bind("playerTeams", ({ fixedTeams }) =>
              pipe(
                Effect.forEach(payload.players, (player) =>
                  pipe(
                    playerService.getTeamsByNames(payload.sheetId, [player.name]),
                    Effect.map((teams) =>
                      pipe(
                        teams,
                        Array.map((team) =>
                          pipe(
                            PlayerTeam.fromTeam(payload.config.cc, team),
                            Option.map((playerTeam) =>
                              PlayerTeam.addTags(
                                pipe(
                                  HashSet.empty<string>(),
                                  HashSet.union(
                                    player.encable ? HashSet.make("encable") : HashSet.empty(),
                                  ),
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
                        Array.getSomes,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Effect.flatMap(({ config, playerTeams }) => calcService.calc(config, playerTeams)),
            Effect.map(Chunk.toArray),
          ),
        ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(CalcService.Default, PlayerService.Default, SheetAuthTokenAuthorizationLive),
  ),
);
