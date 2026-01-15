import { Array, Effect, Function, HashMap, Match, Option, pipe } from "effect";
import { titleCase } from "scule";
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";
import { SheetService } from "./sheetService";
import {
  Player,
  PartialIdPlayer,
  PartialNamePlayer,
  Schedule,
  BreakSchedule,
  SchedulePlayer,
  makeScheduleWithPlayers,
} from "@/server/schema";
import { SignalContext } from "typhoon-core/signal";

export class PlayerService extends Effect.Service<PlayerService>()("PlayerService", {
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
            privateNameToPlayer: pipe(players, ArrayUtils.Collect.toHashMapByKey("name")),
            idToPlayer: pipe(players, ArrayUtils.Collect.toArrayHashMapByKey("id")),
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
      _getByNames: <E = never>(names: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
        pipe(
          Effect.all({
            names: SignalContext.getMaybeSignalEffectValue(names),
            playerMaps,
          }),
          Effect.map(({ names, playerMaps: { nameToPlayer } }) =>
            Array.map(names, (name) =>
              pipe(
                nameToPlayer,
                HashMap.get(titleCase(name, { normalize: true })),
                Option.map(
                  ({ players }) => players as Array.NonEmptyArray<Player | PartialNamePlayer>,
                ),
                Option.getOrElse(() =>
                  Array.make<Array.NonEmptyArray<Player | PartialNamePlayer>>(
                    new PartialNamePlayer({ name: titleCase(name, { normalize: true }) }),
                  ),
                ),
              ),
            ),
          ),
          Effect.withSpan("PlayerService.getByNames", {
            captureStackTrace: true,
          }),
        ),
      _getByIds: <E = never>(ids: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
        pipe(
          Effect.all({
            ids: SignalContext.getMaybeSignalEffectValue(ids),
            playerMaps,
          }),
          Effect.map(({ ids, playerMaps: { idToPlayer } }) =>
            Array.map(ids, (id) =>
              pipe(
                idToPlayer,
                HashMap.get(id),
                Option.getOrElse(() => Array.make(new PartialIdPlayer({ id }))),
                Array.map(Function.identity),
              ),
            ),
          ),
          Effect.withSpan("PlayerService.getByIds", {
            captureStackTrace: true,
          }),
        ),
    })),
    Effect.map(({ sheetService, getPlayerMaps, _getByIds, _getByNames }) => ({
      getPlayerMaps,
      _getByIds,
      _getByNames,
      mapScheduleWithPlayers: (schedule: Schedule | BreakSchedule) =>
        pipe(
          Match.value(schedule),
          Match.tagsExhaustive({
            Schedule: (schedule) =>
              pipe(
                Effect.Do,
                Effect.bindAll(() => ({
                  fills: pipe(
                    schedule.fills,
                    Array.getSomes,
                    Utils.keyPositional("player", _getByNames),
                    Effect.map((fills) =>
                      Array.makeBy(5, (i) =>
                        pipe(
                          fills,
                          Array.get(i),
                          Option.map((fill) =>
                            SchedulePlayer.make({
                              player: pipe(fill.player, Array.headNonEmpty),
                              enc: fill.enc,
                            }),
                          ),
                        ),
                      ),
                    ),
                  ),
                  overfills: pipe(
                    schedule.overfills,
                    Utils.keyPositional("player", _getByNames),
                    Effect.map(
                      Array.map((overfill) =>
                        SchedulePlayer.make({
                          player: pipe(overfill.player, Array.headNonEmpty),
                          enc: overfill.enc,
                        }),
                      ),
                    ),
                  ),
                  standbys: pipe(
                    schedule.standbys,
                    Utils.keyPositional("player", _getByNames),
                    Effect.map(
                      Array.map((standby) =>
                        SchedulePlayer.make({
                          player: pipe(standby.player, Array.headNonEmpty),
                          enc: standby.enc,
                        }),
                      ),
                    ),
                  ),
                  runners: pipe(
                    schedule.runners,
                    Utils.keyPositional("player", _getByNames),
                    Effect.map(
                      Array.map((runner) =>
                        SchedulePlayer.make({
                          player: pipe(runner.player, Array.headNonEmpty),
                          enc: runner.enc,
                        }),
                      ),
                    ),
                  ),
                })),
                Effect.map(({ fills, overfills, standbys, runners }) =>
                  makeScheduleWithPlayers(
                    schedule.channel,
                    schedule.day,
                    schedule.visible,
                    schedule.hour,
                    false,
                    fills,
                    overfills,
                    standbys,
                    runners,
                    schedule.monitor,
                  ),
                ),
              ),
            BreakSchedule: (schedule) => Effect.succeed(schedule),
          }),
          Effect.withSpan("PlayerService.mapScheduleWithPlayers", {
            captureStackTrace: true,
          }),
        ),
      _getTeamsByNames: <E = never>(names: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
        pipe(
          Effect.Do,
          Effect.bindAll(() => ({
            teams: pipe(
              sheetService.getTeams(),
              Effect.map(ArrayUtils.Collect.toArrayHashMapByKey("playerName")),
            ),
            players: _getByNames(names),
          })),
          Effect.map(({ players, teams }) =>
            pipe(
              players,
              Array.map(Array.map((player) => pipe(teams, HashMap.get(Option.some(player.name))))),
              Array.map(Array.getSomes),
              Array.map(Array.flatten),
            ),
          ),
          Effect.withSpan("PlayerService.getTeamsByName", {
            captureStackTrace: true,
          }),
        ),
      _getTeamsByIds: <E = never>(ids: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
        pipe(
          Effect.Do,
          Effect.bindAll(() => ({
            teams: pipe(
              sheetService.getTeams(),
              Effect.map(ArrayUtils.Collect.toArrayHashMapByKey("playerName")),
            ),
            players: _getByIds(ids),
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
              Array.map(Array.map((player) => pipe(teams, HashMap.get(Option.some(player.name))))),
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
}) {
  static getByIds = <E = never>(ids: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
    PlayerService.use(({ _getByIds }) => _getByIds(ids));

  static getByNames = <E = never>(names: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
    PlayerService.use(({ _getByNames }) => _getByNames(names));

  static getTeamsByNames = <E = never>(
    names: SignalContext.MaybeSignalEffect<readonly string[], E>,
  ) => PlayerService.use(({ _getTeamsByNames }) => _getTeamsByNames(names));

  static getTeamsByIds = <E = never>(ids: SignalContext.MaybeSignalEffect<readonly string[], E>) =>
    PlayerService.use(({ _getTeamsByIds }) => _getTeamsByIds(ids));
}
