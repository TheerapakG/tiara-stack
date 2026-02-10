import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class PlayerService extends Effect.Service<PlayerService>()("PlayerService", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      getPlayerMaps: Effect.fn("Player.getPlayerMaps")((guildId: string) =>
        sheetApisClient.get().player.getPlayerMaps({ urlParams: { guildId } }),
      ),
      getPlayerById: Effect.fn("Player.getPlayerById")(
        (guildId: string, ids: ReadonlyArray<string>) =>
          sheetApisClient.get().player.getByIds({ urlParams: { guildId, ids } }),
      ),
      getPlayerByName: Effect.fn("Player.getPlayerByName")(
        (guildId: string, names: ReadonlyArray<string>) =>
          sheetApisClient.get().player.getByNames({ urlParams: { guildId, names } }),
      ),
      getTeamsById: Effect.fn("Player.getTeamsById")(
        (guildId: string, ids: ReadonlyArray<string>) =>
          sheetApisClient.get().player.getTeamsByIds({ urlParams: { guildId, ids } }),
      ),
      getTeamsByName: Effect.fn("Player.getTeamsByName")(
        (guildId: string, names: ReadonlyArray<string>) =>
          sheetApisClient.get().player.getTeamsByNames({ urlParams: { guildId, names } }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
