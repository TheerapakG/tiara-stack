import type { HttpClientError } from "@effect/platform";
import type { DiscordRESTError } from "dfx/DiscordREST";
import { Effect, Layer, pipe } from "effect";
import { DiscordREST } from "dfx";
import { DiscordConfig } from "dfx";
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
  ) as Effect.Effect<GuildMemberUtilsService, never, DiscordREST>,
  accessors: true,
  dependencies: [DiscordGatewayLayer] as const,
}) {}

export const GuildMemberUtilsLive: Layer.Layer<
  GuildMemberUtils,
  never,
  DiscordConfig.DiscordConfig
> = GuildMemberUtils.Default;
