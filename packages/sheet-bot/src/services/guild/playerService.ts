import { bindObject } from "@/utils";
import { Array, Data, Effect, HashMap, Option, pipe } from "effect";
import { Schedule, SheetService } from "./sheetService";

export class Player extends Data.TaggedClass("Player")<{
  id: string;
  idIndex: number;
  name: string;
  nameIndex: number;
}> {}

export class PartialIdPlayer extends Data.TaggedClass("PartialIdPlayer")<{
  id: string;
}> {}

export class PartialNamePlayer extends Data.TaggedClass("PartialNamePlayer")<{
  name: string;
}> {}

export class ScheduleWithPlayers extends Data.TaggedClass(
  "ScheduleWithPlayers",
)<{
  hour: number;
  breakHour: boolean;
  fills: readonly Option.Option<Player | PartialNamePlayer>[];
  overfills: readonly (Player | PartialNamePlayer)[];
  standbys: readonly (Player | PartialNamePlayer)[];
  empty: number;
}> {}

export class PlayerService extends Effect.Service<PlayerService>()(
  "PlayerService",
  {
    effect: pipe(
      Effect.Do,
      bindObject({ sheetService: SheetService }),
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
              nameToPlayer: HashMap.fromIterable(
                players.map((p) => [p.name, p] as const),
              ),
              idToPlayer: HashMap.fromIterable(
                players.map((p) => [p.id, p] as const),
              ),
            })),
            Effect.withSpan("PlayerService.playerMaps", {
              captureStackTrace: true,
            }),
          ),
        ),
      })),
      Effect.map(({ playerMaps }) => ({
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
            Effect.map(Option.getOrElse(() => new PartialNamePlayer({ name }))),
            Effect.withSpan("PlayerService.getByName", {
              captureStackTrace: true,
            }),
          ),
        getById: (id: string) =>
          pipe(
            playerMaps,
            Effect.map(({ idToPlayer }) => HashMap.get(idToPlayer, id)),
            Effect.map(Option.getOrElse(() => new PartialIdPlayer({ id }))),
            Effect.withSpan("PlayerService.getById", {
              captureStackTrace: true,
            }),
          ),
      })),
      Effect.map(({ getPlayerMaps, getById, getByName }) => ({
        getPlayerMaps,
        getById,
        getByName,
        mapScheduleWithPlayers: (schedule: Schedule) =>
          pipe(
            Effect.Do,
            bindObject({
              fills: pipe(
                schedule.fills,
                Effect.forEach(
                  (fill) => pipe(fill, Effect.transposeMapOption(getByName)),
                  { concurrency: "unbounded" },
                ),
              ),
              overfills: pipe(
                schedule.overfills,
                Effect.forEach(getByName, { concurrency: "unbounded" }),
              ),
              standbys: pipe(
                schedule.standbys,
                Effect.forEach(getByName, { concurrency: "unbounded" }),
              ),
            }),
            Effect.map(
              ({ fills, overfills, standbys }) =>
                new ScheduleWithPlayers({
                  hour: schedule.hour,
                  breakHour: schedule.breakHour,
                  fills,
                  overfills,
                  standbys,
                  empty: schedule.empty,
                }),
            ),
            Effect.withSpan("PlayerService.mapScheduleWithPlayers", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    accessors: true,
  },
) {}
