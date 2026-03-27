import {
  CacheNotFoundError,
  MembersApiCacheView,
  RolesApiCacheView,
} from "dfx-discord-utils/discord";
import { Effect, HashSet, Redacted } from "effect";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { GuildConfigService } from "@/services/guildConfig";

export type TestPermission =
  | "bot"
  | "app_owner"
  | `member_guild:${string}`
  | `monitor_guild:${string}`
  | `manage_guild:${string}`
  | `account:discord:${string}`;

export const makeUser = (
  permissions: ReadonlyArray<TestPermission>,
  identity = { accountId: "discord-account-1", userId: "better-auth-user-1" },
) => ({
  accountId: identity.accountId,
  userId: identity.userId,
  permissions: HashSet.fromIterable(permissions),
  token: Redacted.make("token"),
});

export const withUser =
  <A, E, R>(
    permissions: ReadonlyArray<TestPermission>,
    identity?: { accountId: string; userId: string },
  ) =>
  (effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.provideService(SheetAuthUser, makeUser(permissions, identity)));

export const liveGuildServices =
  (options?: {
    readonly memberAccountId?: string;
    readonly memberGuildId?: string;
    readonly memberRoles?: ReadonlyArray<string>;
    readonly monitorRoleIds?: ReadonlyArray<string>;
  }) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(MembersApiCacheView, {
        get: (guildId: string, accountId: string) =>
          options?.memberAccountId === accountId &&
          guildId === (options?.memberGuildId ?? "guild-1")
            ? Effect.succeed({
                roles: [...(options?.memberRoles ?? [])],
                user: { id: accountId },
              })
            : Effect.fail(new CacheNotFoundError({ message: "not found" })),
      } as unknown as MembersApiCacheView),
      Effect.provideService(GuildConfigService, {
        getGuildMonitorRoles: () =>
          Effect.succeed((options?.monitorRoleIds ?? []).map((roleId) => ({ roleId }))),
      } as unknown as GuildConfigService),
      Effect.provideService(RolesApiCacheView, {
        getForParent: () => Effect.succeed(new Map()),
      } as unknown as RolesApiCacheView),
    );

export const getFailure = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.flip);
