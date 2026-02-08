import { Effect, pipe } from "effect";
import { DiscordGatewayLayer } from "../discord/gateway";
import { DiscordREST } from "dfx";

export class GuildMemberUtils extends Effect.Service<GuildMemberUtils>()("GuildMemberUtils", {
  effect: pipe(
    DiscordREST,
    Effect.map((rest) => ({
      addRoles: Effect.fn("guildMember.addRoles")(function* (
        guildId: string,
        userId: string,
        roleIds: string[],
      ) {
        return yield* Effect.all(
          roleIds.map((roleId) => rest.addGuildMemberRole(guildId, userId, roleId)),
        );
      }),
      removeRoles: Effect.fn("guildMember.removeRoles")(function* (
        guildId: string,
        userId: string,
        roleIds: string[],
      ) {
        return yield* Effect.all(
          roleIds.map((roleId) => rest.deleteGuildMemberRole(guildId, userId, roleId)),
        );
      }),
    })),
  ),
  accessors: true,
  dependencies: [DiscordGatewayLayer],
}) {}
