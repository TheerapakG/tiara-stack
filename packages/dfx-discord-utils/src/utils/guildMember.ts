import { Effect, Layer, Context } from "effect";
import { HttpClientError } from "effect/unstable/http";
import { Discord, DiscordConfig, DiscordREST } from "dfx";
import { discordGatewayLayer } from "../discord/gateway";

export class GuildMemberUtils extends Context.Service<GuildMemberUtils>()("GuildMemberUtils", {
  make: Effect.gen(function* () {
    const discordREST = yield* DiscordREST;
    return {
      addRoles: Effect.fn("guildMember.addRoles")(function* (
        guildId: string,
        userId: string,
        roleIds: string[],
      ) {
        return yield* Effect.all(
          roleIds.map((roleId) => discordREST.addGuildMemberRole(guildId, userId, roleId)),
        );
      }),
      removeRoles: Effect.fn("guildMember.removeRoles")(function* (
        guildId: string,
        userId: string,
        roleIds: string[],
      ) {
        return yield* Effect.all(
          roleIds.map((roleId) => discordREST.deleteGuildMemberRole(guildId, userId, roleId)),
        );
      }),
    };
  }),
}) {
  static layer = Layer.effect(GuildMemberUtils, this.make).pipe(
    Layer.provide(discordGatewayLayer),
  ) as Layer.Layer<
    GuildMemberUtils,
    | Discord.DiscordRestError<"ErrorResponse", Discord.ErrorResponse>
    | Discord.DiscordRestError<"RatelimitedResponse", Discord.RatelimitedResponse>
    | HttpClientError.HttpClientError,
    DiscordConfig.DiscordConfig
  >;
}
