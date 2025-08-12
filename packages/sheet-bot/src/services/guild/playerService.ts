import { Array, Data, Effect, HashMap, Option, pipe } from "effect";
import { SheetService } from "./sheetService";

export class Player extends Data.TaggedClass("Player")<{
  id: string;
  idIndex: number;
  name: string;
  nameIndex: number;
}> {}

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
            Effect.withSpan("PlayerService.getByName", {
              captureStackTrace: true,
            }),
          ),
        getById: (id: string) =>
          pipe(
            playerMaps,
            Effect.map(({ idToPlayer }) => HashMap.get(idToPlayer, id)),
            Effect.withSpan("PlayerService.getById", {
              captureStackTrace: true,
            }),
          ),
      })),
    ),
    accessors: true,
  },
) {}
