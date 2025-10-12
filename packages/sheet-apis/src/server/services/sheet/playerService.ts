import { Array, Effect, HashMap, Match, Option, pipe } from "effect";
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
              Array.map(({ id, name, idIndex, nameIndex }) =>
                Option.isSome(id) && Option.isSome(name)
                  ? Option.some(
                      new Player({
                        id: id.value,
                        idIndex,
                        name: name.value,
                        nameIndex,
                      }),
                    )
                  : Option.none(),
              ),
            ),
            Effect.map(Array.getSomes),
            Effect.map((players) => ({
              privateNameToPlayer: pipe(
                players,
                ArrayUtils.Collect.toHashMap({
                  keyGetter: ({ name }) => name,
                  valueInitializer: (player) => player,
                  valueReducer: (_, player) => player,
                }),
              ),
              idToPlayer: pipe(
                players,
                ArrayUtils.Collect.toHashMap({
                  keyGetter: ({ id }) => id,
                  valueInitializer: (player) => ({
                    id: player.id,
                    players: Array.make(player),
                  }),
                  valueReducer: ({ id, players }, player) => ({
                    id,
                    players: Array.append(players, player),
                  }),
                }),
              ),
            })),
            Effect.map(({ privateNameToPlayer, idToPlayer }) => ({
              nameToPlayer: pipe(
                privateNameToPlayer,
                HashMap.map((player) => ({
                  name: player.name,
                  players: pipe(
                    idToPlayer,
                    HashMap.get(player.id),
                    Option.map(({ players }) => players),
                  ),
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
        getByName: (name: string) =>
          pipe(
            playerMaps,
            Effect.map(({ nameToPlayer }) => HashMap.get(nameToPlayer, name)),
            Effect.map(
              Option.map(
                ({ players }) =>
                  players as Array.NonEmptyArray<Player | PartialNamePlayer>,
              ),
            ),
            Effect.map(
              Option.getOrElse(() =>
                Array.make<Array.NonEmptyArray<Player | PartialNamePlayer>>(
                  new PartialNamePlayer({ name }),
                ),
              ),
            ),
            Effect.withSpan("PlayerService.getByName", {
              captureStackTrace: true,
            }),
          ),
        getById: (id: string) =>
          pipe(
            playerMaps,
            Effect.map(({ idToPlayer }) => HashMap.get(idToPlayer, id)),
            Effect.map(
              Option.map(
                ({ players }) =>
                  players as Array.NonEmptyArray<Player | PartialIdPlayer>,
              ),
            ),
            Effect.map(
              Option.getOrElse(() =>
                Array.make<Array.NonEmptyArray<Player | PartialIdPlayer>>(
                  new PartialIdPlayer({ id }),
                ),
              ),
            ),
            Effect.withSpan("PlayerService.getById", {
              captureStackTrace: true,
            }),
          ),
      })),
      Effect.map(({ sheetService, getPlayerMaps, getById, getByName }) => ({
        getPlayerMaps,
        getById,
        getByName,
        mapScheduleWithPlayers: (schedule: Schedule) =>
          pipe(
            Effect.Do,
            Effect.bindAll(() => ({
              fills: pipe(
                schedule.fills,
                Effect.forEach(
                  (fill) =>
                    pipe(
                      fill,
                      Effect.transposeMapOption(getByName),
                      Effect.map(Option.map(Array.headNonEmpty)),
                    ),
                  { concurrency: "unbounded" },
                ),
              ),
              overfills: pipe(
                schedule.overfills,
                Effect.forEach(
                  (overfill) =>
                    pipe(overfill, getByName, Effect.map(Array.headNonEmpty)),
                  { concurrency: "unbounded" },
                ),
              ),
              standbys: pipe(
                schedule.standbys,
                Effect.forEach(
                  (standby) =>
                    pipe(standby, getByName, Effect.map(Array.headNonEmpty)),
                  { concurrency: "unbounded" },
                ),
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
        getTeamsByName: (name: string) =>
          pipe(
            Effect.Do,
            Effect.bindAll(() => ({
              teams: sheetService.getTeams(),
              playerNames: pipe(
                getByName(name),
                Effect.map(Array.map((player) => player.name)),
              ),
            })),
            Effect.map(({ playerNames, teams }) =>
              pipe(
                playerNames,
                Array.map((player) =>
                  pipe(
                    teams,
                    HashMap.get(player),
                    Option.map(({ teams }) => teams),
                  ),
                ),
                Array.getSomes,
                Array.flatten,
              ),
            ),
            Effect.withSpan("PlayerService.getTeamsByName", {
              captureStackTrace: true,
            }),
          ),
        getTeamsById: (id: string) =>
          pipe(
            Effect.Do,
            Effect.bindAll(() => ({
              teams: sheetService.getTeams(),
              playerNames: pipe(
                getById(id),
                Effect.map(
                  Array.map((player) =>
                    pipe(
                      Match.value(player),
                      Match.tagsExhaustive({
                        Player: (player) => Option.some(player.name),
                        PartialIdPlayer: () => Option.none(),
                      }),
                    ),
                  ),
                ),
                Effect.map(Array.getSomes),
              ),
            })),
            Effect.map(({ playerNames, teams }) =>
              pipe(
                playerNames,
                Array.map((player) =>
                  pipe(
                    teams,
                    HashMap.get(player),
                    Option.map(({ teams }) => teams),
                  ),
                ),
                Array.getSomes,
                Array.flatten,
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
