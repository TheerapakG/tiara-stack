import { Effect, Layer, Context } from "effect";
import { SheetApisClient } from "./sheetApis";

export class PlayerService extends Context.Service<PlayerService>()("PlayerService", {
  make: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;

    return {
      getPlayerMaps: Effect.fn("Player.getPlayerMaps")(function* (guildId: string) {
        return yield* sheetApisClient.get().player.getPlayerMaps({ query: { guildId } });
      }),
      getPlayerById: Effect.fn("Player.getPlayerById")(function* (
        guildId: string,
        ids: ReadonlyArray<string>,
      ) {
        return yield* sheetApisClient.get().player.getByIds({ query: { guildId, ids } });
      }),
      getPlayerByName: Effect.fn("Player.getPlayerByName")(function* (
        guildId: string,
        names: ReadonlyArray<string>,
      ) {
        return yield* sheetApisClient.get().player.getByNames({ query: { guildId, names } });
      }),
      getTeamsById: Effect.fn("Player.getTeamsById")(function* (
        guildId: string,
        ids: ReadonlyArray<string>,
      ) {
        return yield* sheetApisClient.get().player.getTeamsByIds({ query: { guildId, ids } });
      }),
      getTeamsByName: Effect.fn("Player.getTeamsByName")(function* (
        guildId: string,
        names: ReadonlyArray<string>,
      ) {
        return yield* sheetApisClient.get().player.getTeamsByNames({ query: { guildId, names } });
      }),
    };
  }),
}) {
  static layer = Layer.effect(PlayerService, this.make).pipe(Layer.provide(SheetApisClient.layer));
}
