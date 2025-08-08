import { Array, Data, Effect, HashMap, Option, pipe } from "effect";
import { SheetService } from "./sheetService";

export class Player extends Data.TaggedClass("Player")<{
  id: string;
  name: string;
}> {}

export class PlayerService extends Effect.Service<PlayerService>()(
  "PlayerService",
  {
    effect: pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        playerMaps: Effect.cached(
          pipe(
            SheetService.getPlayers(),
            Effect.map(
              Array.map(({ id, name }) =>
                Option.isSome(id) && Option.isSome(name)
                  ? Option.some(new Player({ id: id.value, name: name.value }))
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
