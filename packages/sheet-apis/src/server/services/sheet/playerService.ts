import { Array, Effect, Function, HashMap, Match, Option, pipe } from "effect";
import { Array as ArrayUtils } from "typhoon-core/utils";
import { SheetService } from "./sheetService";
import {
  Player,
  PartialIdPlayer,
  PartialNamePlayer,
  Schedule,
  ScheduleWithPlayers,
} from "@/server/schema";

export class PlayerService extends Effect.Service<PlayerService>()(
  "PlayerService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("sheetService", () => SheetService),
      Effect.bindAll(({ sheetService }) => ({
        playerMaps: Effect.cached(
          pipe(
            sheetService.getPlayers(),
            Effect.map(
              Array.map(({ index, id, name }) =>
                Option.isSome(id) && Option.isSome(name)
                  ? Option.some(
                      new Player({
                        index,
                        id: id.value,
                        name: name.value,
                      }),
                    )
                  : Option.none(),
              ),
            ),
            Effect.map(Array.getSomes),
            Effect.map((players) => ({
              privateNameToPlayer: pipe(
                players,
                ArrayUtils.Collect.toHashMapByKey("name"),
              ),
              idToPlayer: pipe(
                players,
                ArrayUtils.Collect.toArrayHashMapByKey("id"),
              ),
            })),
            Effect.map(({ privateNameToPlayer, idToPlayer }) => ({
              nameToPlayer: pipe(
                privateNameToPlayer,
                HashMap.map((player) => ({
                  name: player.name,
                  players: pipe(idToPlayer, HashMap.get(player.id)),
                })),
                HashMap.filterMap((a, _) =>
                  pipe(
                    a.players,
                    Option.map((players) => ({ name: a.name, players })),
                  ),
                ),
              ),
              idToPlayer,
            })),
            Effect.withSpan("PlayerService.playerMaps", {
              captureStackTrace: true,
            }),
          ),
        ),
      })),
      Effect.map(({ sheetService, playerMaps }) => ({
        sheetService,
        getPlayerMaps: () =>
          pipe(
            playerMaps,
            Effect.withSpan("PlayerService.getPlayerMaps", {
              captureStackTrace: true,
            }),
          ),
        getByNames: (names: readonly string[]) =>
          pipe(
            playerMaps,
            Effect.map(({ nameToPlayer }) =>
              Array.map(names, (name) =>
                pipe(
                  nameToPlayer,
                  HashMap.get(name),
                  Option.map(
                    ({ players }) =>
                      players as Array.NonEmptyArray<
                        Player | PartialNamePlayer
                      >,
                  ),
                  Option.getOrElse(() =>
                    Array.make<Array.NonEmptyArray<Player | PartialNamePlayer>>(
                      new PartialNamePlayer({ name }),
                    ),
                  ),
                ),
              ),
            ),
            Effect.withSpan("PlayerService.getByNames", {
              captureStackTrace: true,
            }),
          ),
        getByIds: (ids: readonly string[]) =>
          pipe(
            playerMaps,
            Effect.map(({ idToPlayer }) =>
              Array.map(ids, (id) =>
                pipe(
                  idToPlayer,
                  HashMap.get(id),
                  Option.getOrElse(() =>
                    Array.make(new PartialIdPlayer({ id })),
                  ),
                  Array.map(Function.identity),
                ),
              ),
            ),
            Effect.withSpan("PlayerService.getByIds", {
              captureStackTrace: true,
            }),
          ),
      })),
      Effect.map(({ sheetService, getPlayerMaps, getByIds, getByNames }) => ({
        getPlayerMaps,
        getByIds,
        getByNames,
        mapScheduleWithPlayers: (schedule: Schedule) =>
          pipe(
            Effect.Do,
            Effect.bindAll(() => ({
              fills: pipe(
                schedule.fills,
                Array.getSomes,
                getByNames,
                Effect.map((fills) =>
                  Array.makeBy(5, (i) =>
                    pipe(fills, Array.get(i), Option.map(Array.headNonEmpty)),
                  ),
                ),
              ),
              overfills: pipe(
                schedule.overfills,
                getByNames,
                Effect.map(Array.map(Array.headNonEmpty)),
              ),
              standbys: pipe(
                schedule.standbys,
                getByNames,
                Effect.map(Array.map(Array.headNonEmpty)),
              ),
            })),
            Effect.map(
              ({ fills, overfills, standbys }) =>
                new ScheduleWithPlayers({
                  hour: schedule.hour,
                  breakHour: schedule.breakHour,
                  fills,
                  overfills,
                  standbys,
                }),
            ),
            Effect.withSpan("PlayerService.mapScheduleWithPlayers", {
              captureStackTrace: true,
            }),
          ),
        getTeamsByNames: (names: readonly string[]) =>
          pipe(
            Effect.Do,
            Effect.bindAll(() => ({
              teams: pipe(
                sheetService.getTeams(),
                Effect.map(
                  ArrayUtils.Collect.toArrayHashMapByKey("playerName"),
                ),
              ),
              players: getByNames(names),
            })),
            Effect.map(({ players, teams }) =>
              pipe(
                players,
                Array.map(
                  Array.map((player) =>
                    pipe(teams, HashMap.get(Option.some(player.name))),
                  ),
                ),
                Array.map(Array.getSomes),
                Array.map(Array.flatten),
              ),
            ),
            Effect.withSpan("PlayerService.getTeamsByName", {
              captureStackTrace: true,
            }),
          ),
        getTeamsByIds: (ids: readonly string[]) =>
          pipe(
            Effect.Do,
            Effect.bindAll(() => ({
              teams: pipe(
                sheetService.getTeams(),
                Effect.map(
                  ArrayUtils.Collect.toArrayHashMapByKey("playerName"),
                ),
              ),
              players: getByIds(ids),
            })),
            Effect.map(({ players, teams }) =>
              pipe(
                players,
                Array.map(
                  Array.map((player) =>
                    pipe(
                      Match.value(player),
                      Match.tagsExhaustive({
                        Player: (player) => Option.some(player),
                        PartialIdPlayer: () => Option.none(),
                      }),
                    ),
                  ),
                ),
                Array.map(Array.getSomes),
                Array.map(
                  Array.map((player) =>
                    pipe(teams, HashMap.get(Option.some(player.name))),
                  ),
                ),
                Array.map(Array.getSomes),
                Array.map(Array.flatten),
              ),
            ),
            Effect.withSpan("PlayerService.getTeamsById", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    accessors: true,
  },
) {}
