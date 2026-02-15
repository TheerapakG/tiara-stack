import type { HttpClientError } from "@effect/platform";
import type { DiscordRESTError } from "dfx/DiscordREST";
import { Effect, pipe } from "effect";
import { DiscordREST } from "dfx";
import { DiscordGatewayLayer } from "../discord/gateway";

// Import HttpClientError to ensure it's available in the type definitions
export type { HttpClientError, DiscordRESTError };

export interface GuildMemberUtilsService {
  readonly addRoles: (
    guildId: string,
    userId: string,
    roleIds: string[],
  ) => Effect.Effect<void[], DiscordRESTError, never>;
  readonly removeRoles: (
    guildId: string,
    userId: string,
    roleIds: string[],
  ) => Effect.Effect<void[], DiscordRESTError, never>;
}

const GuildMemberUtilsBase = Effect.Service<GuildMemberUtilsService>()("GuildMemberUtils", {
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
});

export class GuildMemberUtils extends GuildMemberUtilsBase {}
