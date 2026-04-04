import { Effect, Layer, ServiceMap } from "effect";
import { DiscordREST } from "dfx";
import { discordGatewayLayer } from "../discord/gateway";

export class GuildMemberUtils extends ServiceMap.Service<GuildMemberUtils>()("GuildMemberUtils", {
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
  static layer = Layer.effect(GuildMemberUtils, this.make).pipe(Layer.provide(discordGatewayLayer));
}
