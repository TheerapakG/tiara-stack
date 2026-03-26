import {
  CacheNotFoundError,
  MembersApiCacheView,
  RolesApiCacheView,
} from "dfx-discord-utils/discord";
import type { CachedGuildMember } from "dfx-discord-utils/cache";
import { Discord, Perms } from "dfx";
import { Effect, HashSet, Option } from "effect";
import type { Permission, PermissionSet } from "@/schemas/permissions";
import { SheetAuthGuildUser } from "@/schemas/middlewares/sheetAuthGuildUser";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { GuildConfigService } from "@/services/guildConfig";

export const permissionSetFromIterable = (permissions: Iterable<Permission>): PermissionSet =>
  HashSet.fromIterable(permissions);

export const hasPermission = (permissions: PermissionSet, permission: Permission) =>
  HashSet.has(permissions, permission);

export const hasGuildPermission = (
  permissions: PermissionSet,
  prefix: "member_guild" | "monitor_guild" | "manage_guild",
  guildId: string,
) => HashSet.has(permissions, `${prefix}:${guildId}`);

export const hasDiscordAccountPermission = (permissions: PermissionSet, accountId: string) =>
  HashSet.has(permissions, `account:discord:${accountId}`);

const requirePermissions = (
  permissions: PermissionSet,
  predicate: (permissions: PermissionSet) => boolean,
  message: string,
) => (predicate(permissions) ? Effect.void : Effect.fail(new Unauthorized({ message })));

export const appendPermission = (
  permissions: PermissionSet,
  permission: Permission,
): PermissionSet => HashSet.add(permissions, permission);

const appendPermissions = (
  permissions: PermissionSet,
  nextPermissions: Iterable<Permission>,
): PermissionSet => HashSet.union(permissions, permissionSetFromIterable(nextPermissions));

const hasManageGuildPermission = (
  member: CachedGuildMember,
  roles: ReadonlyMap<string, Discord.GuildRoleResponse>,
) => {
  const resolvedUserPermissions = Perms.forMember([...roles.values()])(
    member as Discord.GuildMemberResponse,
  );

  return Perms.has(Discord.Permissions.ManageGuild)(resolvedUserPermissions);
};

const hasMonitorGuildPermission = (
  member: { roles: ReadonlyArray<string> },
  monitorRoleIds: ReadonlySet<string>,
) => member.roles.some((roleId) => monitorRoleIds.has(roleId));

const getOptionalGuildMember = (
  guildId: string,
  accountId: string,
  membersCache: MembersApiCacheView,
) =>
  membersCache.get(guildId, accountId).pipe(
    Effect.map(Option.some),
    Effect.catchAll((error) => {
      if (error instanceof CacheNotFoundError) {
        return Effect.succeed(Option.none());
      }

      return Effect.logError(error).pipe(Effect.as(Option.none()));
    }),
  );

type GuildPermissionScope = "member" | "monitor" | "manage";

interface ResolvedGuildPermissions {
  permissions: PermissionSet;
  maybeMember: Option.Option<CachedGuildMember>;
}

const makeSheetAuthGuildUser = (
  user: SheetAuthUser["Type"],
  guildId: string,
  permissions: PermissionSet,
): SheetAuthGuildUser["Type"] => ({
  accountId: user.accountId,
  userId: user.userId,
  guildId,
  permissions,
  token: user.token,
});

const getOptionalMonitorRoleIds = (guildId: string, guildConfigService: GuildConfigService) =>
  guildConfigService
    .getGuildMonitorRoles(guildId)
    .pipe(
      Effect.tapError(Effect.logError),
      Effect.option,
      Effect.map(
        Option.map(
          (monitorRoles) => new Set(monitorRoles.map((role) => role.roleId)) as ReadonlySet<string>,
        ),
      ),
    );

const getOptionalGuildRoles = (guildId: string, rolesCache: RolesApiCacheView) =>
  rolesCache.getForParent(guildId).pipe(Effect.tapError(Effect.logError), Effect.option);

const resolveGuildScopedPermissions = (
  user: SheetAuthUser["Type"],
  guildId: string,
): Effect.Effect<
  ResolvedGuildPermissions,
  never,
  MembersApiCacheView | GuildConfigService | RolesApiCacheView
> =>
  Effect.gen(function* () {
    if (hasPermission(user.permissions, "bot") || hasPermission(user.permissions, "app_owner")) {
      return {
        permissions: appendPermissions(user.permissions, [
          `member_guild:${guildId}`,
          `monitor_guild:${guildId}`,
          `manage_guild:${guildId}`,
        ]),
        maybeMember: Option.none(),
      } satisfies ResolvedGuildPermissions;
    }

    const { membersCache, guildConfigService, rolesCache } = yield* Effect.all({
      membersCache: MembersApiCacheView,
      guildConfigService: GuildConfigService,
      rolesCache: RolesApiCacheView,
    });

    const [maybeMember, maybeMonitorRoleIds, maybeRoles] = yield* Effect.all(
      [
        getOptionalGuildMember(guildId, user.accountId, membersCache),
        getOptionalMonitorRoleIds(guildId, guildConfigService),
        getOptionalGuildRoles(guildId, rolesCache),
      ],
      { concurrency: "unbounded" },
    );

    let permissions = user.permissions;

    if (Option.isSome(maybeMember)) {
      permissions = appendPermission(permissions, `member_guild:${guildId}`);
    }

    if (
      Option.isSome(maybeMember) &&
      Option.isSome(maybeMonitorRoleIds) &&
      maybeMonitorRoleIds.value.size > 0 &&
      hasMonitorGuildPermission(maybeMember.value, maybeMonitorRoleIds.value)
    ) {
      permissions = appendPermission(permissions, `monitor_guild:${guildId}`);
    }

    if (
      Option.isSome(maybeMember) &&
      Option.isSome(maybeRoles) &&
      hasManageGuildPermission(maybeMember.value, maybeRoles.value)
    ) {
      permissions = appendPermission(permissions, `manage_guild:${guildId}`);
    }

    return {
      permissions,
      maybeMember,
    } satisfies ResolvedGuildPermissions;
  });

export const resolveSheetAuthGuildUser = (user: SheetAuthUser["Type"], guildId: string) =>
  resolveGuildScopedPermissions(user, guildId).pipe(
    Effect.map(({ permissions }) => makeSheetAuthGuildUser(user, guildId, permissions)),
  );

export const resolveCurrentGuildUser = (guildId: string) =>
  SheetAuthUser.pipe(Effect.flatMap((user) => resolveSheetAuthGuildUser(user, guildId)));

const provideResolvedGuildUser = <A, E, R, R2>(
  resolvedGuildUser: Effect.Effect<SheetAuthGuildUser["Type"], never, R2>,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R | R2, SheetAuthGuildUser>> =>
  resolvedGuildUser.pipe(
    Effect.flatMap((user) => effect.pipe(Effect.provideService(SheetAuthGuildUser, user))),
    // Safe cast: provideService satisfies SheetAuthGuildUser for downstream effects,
    // but TypeScript does not remove the requirement from R automatically.
  ) as Effect.Effect<A, E, Exclude<R | R2, SheetAuthGuildUser>>;

export const provideCurrentGuildUser = <A, E, R>(guildId: string, effect: Effect.Effect<A, E, R>) =>
  provideResolvedGuildUser(resolveCurrentGuildUser(guildId), effect);

const getRequiredCurrentGuildUser = (guildId: string) =>
  SheetAuthGuildUser.pipe(
    Effect.flatMap((user) =>
      user.guildId === guildId
        ? Effect.succeed(user)
        : Effect.die(
            new Error(
              `SheetAuthGuildUser guild mismatch: expected ${guildId}, received ${user.guildId}`,
            ),
          ),
    ),
  );

export const getGuildMonitorAccessLevel = (user: SheetAuthUser["Type"], guildId: string) =>
  resolveSheetAuthGuildUser(user, guildId).pipe(
    Effect.map((resolvedUser) =>
      hasGuildPermission(resolvedUser.permissions, "monitor_guild", guildId)
        ? ("monitor" as const)
        : hasGuildPermission(resolvedUser.permissions, "member_guild", guildId)
          ? ("member" as const)
          : ("none" as const),
    ),
  );

const requireResolvedGuildPermission = (
  guildId: string,
  scope: GuildPermissionScope,
  message: string,
) =>
  getRequiredCurrentGuildUser(guildId).pipe(
    Effect.flatMap((user) => {
      const hasRequiredScope =
        scope === "member"
          ? hasGuildPermission(user.permissions, "member_guild", guildId)
          : scope === "monitor"
            ? hasGuildPermission(user.permissions, "monitor_guild", guildId)
            : hasGuildPermission(user.permissions, "manage_guild", guildId);

      return hasRequiredScope ? Effect.void : Effect.fail(new Unauthorized({ message }));
    }),
  );

export const requireManageGuild = (
  guildId: string,
  message = "User does not have manage guild permission",
) => requireResolvedGuildPermission(guildId, "manage", message);

export const requireMonitorGuild = (
  guildId: string,
  message = "User does not have monitor guild permission",
) => requireResolvedGuildPermission(guildId, "monitor", message);

export const requireBot = (message = "User is not the bot") =>
  SheetAuthUser.pipe(
    Effect.flatMap((user) =>
      requirePermissions(
        user.permissions,
        (permissions) => hasPermission(permissions, "bot"),
        message,
      ),
    ),
  );

export const requireDiscordAccountId = (
  accountId: string,
  message = "User does not have access to this user",
) =>
  SheetAuthUser.pipe(
    Effect.flatMap((user) =>
      requirePermissions(
        user.permissions,
        (permissions) =>
          hasPermission(permissions, "bot") ||
          hasPermission(permissions, "app_owner") ||
          hasDiscordAccountPermission(permissions, accountId),
        message,
      ),
    ),
  );

export const requireDiscordAccountIdOrMonitorGuild = (
  guildId: string,
  accountId: string,
  message = "User does not have access to this user",
) =>
  getRequiredCurrentGuildUser(guildId).pipe(
    Effect.flatMap((user) =>
      hasPermission(user.permissions, "bot") ||
      hasPermission(user.permissions, "app_owner") ||
      hasDiscordAccountPermission(user.permissions, accountId) ||
      hasGuildPermission(user.permissions, "monitor_guild", guildId)
        ? Effect.void
        : Effect.fail(new Unauthorized({ message })),
    ),
  );

export const requireGuildMember = (
  guildId: string,
  message = "User is not a member of this guild",
) => requireResolvedGuildPermission(guildId, "member", message);
