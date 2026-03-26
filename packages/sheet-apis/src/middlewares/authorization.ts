import {
  CacheNotFoundError,
  MembersApiCacheView,
  RolesApiCacheView,
} from "dfx-discord-utils/discord";
import { Discord, Perms } from "dfx";
import { Effect, Option } from "effect";
import type { Permission } from "@/schemas/permissions";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { GuildConfigService } from "@/services/guildConfig";

export const hasPermission = (permissions: ReadonlyArray<Permission>, permission: Permission) =>
  permissions.includes(permission);

export const hasGuildPermission = (
  permissions: ReadonlyArray<Permission>,
  prefix: "member_guild" | "monitor_guild" | "manage_guild",
  guildId: string,
) => permissions.includes(`${prefix}:${guildId}`);

export const hasUserPermission = (permissions: ReadonlyArray<Permission>, userId: string) =>
  permissions.includes(`user:${userId}`);

const requirePermissions = (
  permissions: ReadonlyArray<Permission>,
  predicate: (permissions: ReadonlyArray<Permission>) => boolean,
  message: string,
) => (predicate(permissions) ? Effect.void : Effect.fail(new Unauthorized({ message })));

export const appendPermission = (
  permissions: ReadonlyArray<Permission>,
  permission: Permission,
): Permission[] =>
  permissions.includes(permission) ? [...permissions] : [...permissions, permission];

const appendPermissions = (
  permissions: ReadonlyArray<Permission>,
  nextPermissions: ReadonlyArray<Permission>,
): Permission[] => nextPermissions.reduce(appendPermission, [...permissions]);

const hasManageGuildPermission = (
  member: {
    roles: ReadonlyArray<string>;
    pending?: boolean;
    flags?: number;
    joined_at?: string;
  } & Record<string, unknown>,
  roles: ReadonlyMap<string, unknown>,
) => {
  const memberForPermissionCheck = {
    ...member,
    flags: member.flags ?? 0,
    joined_at: member.joined_at ?? "",
    mute: false,
    deaf: false,
    pending: member.pending ?? false,
  };
  const resolvedUserPermissions = Perms.forMember([...roles.values()] as never[])(
    memberForPermissionCheck as never,
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

type GuildPermissionMember = Parameters<typeof hasManageGuildPermission>[0];

interface ResolvedGuildPermissions {
  permissions: Permission[];
  maybeMember: Option.Option<GuildPermissionMember>;
}

export const resolveMemberGuildScopedPermissions = (
  user: SheetAuthUser["Type"],
  guildId: string,
  membersCache: MembersApiCacheView,
): Effect.Effect<ResolvedGuildPermissions> =>
  Effect.gen(function* () {
    if (hasPermission(user.permissions, "bot") || hasPermission(user.permissions, "app_owner")) {
      return {
        permissions: appendPermissions(user.permissions, [`member_guild:${guildId}`]),
        maybeMember: Option.none(),
      } satisfies ResolvedGuildPermissions;
    }

    const memberPermission = `member_guild:${guildId}` as const;
    const needsMemberPermission = !user.permissions.includes(memberPermission);
    // We still hydrate maybeMember even when member_guild is already present so
    // downstream monitor/manage resolution can inspect live Discord roles.
    const maybeMember = yield* getOptionalGuildMember(guildId, user.accountId, membersCache);

    if (!needsMemberPermission) {
      return {
        permissions: [...user.permissions],
        maybeMember,
      } satisfies ResolvedGuildPermissions;
    }

    if (Option.isNone(maybeMember)) {
      return {
        permissions: [...user.permissions],
        maybeMember,
      } satisfies ResolvedGuildPermissions;
    }

    return {
      permissions: appendPermission(user.permissions, memberPermission),
      maybeMember,
    } satisfies ResolvedGuildPermissions;
  });

export const resolveMonitorGuildScopedPermissions = (
  user: SheetAuthUser["Type"],
  guildId: string,
  membersCache: MembersApiCacheView,
  guildConfigService: GuildConfigService,
): Effect.Effect<ResolvedGuildPermissions> =>
  resolveMemberGuildScopedPermissions(user, guildId, membersCache).pipe(
    Effect.flatMap(({ permissions, maybeMember }) => {
      if (hasPermission(user.permissions, "bot") || hasPermission(user.permissions, "app_owner")) {
        return Effect.succeed({
          permissions: appendPermissions(permissions, [`monitor_guild:${guildId}`]),
          maybeMember,
        } satisfies ResolvedGuildPermissions);
      }

      const monitorPermission = `monitor_guild:${guildId}` as const;
      if (permissions.includes(monitorPermission)) {
        return Effect.succeed({
          permissions: [...permissions],
          maybeMember,
        } satisfies ResolvedGuildPermissions);
      }

      if (!permissions.includes(`member_guild:${guildId}`)) {
        return Effect.succeed({
          permissions: [...permissions],
          maybeMember,
        } satisfies ResolvedGuildPermissions);
      }

      return guildConfigService.getGuildMonitorRoles(guildId).pipe(
        Effect.tapError(Effect.logError),
        Effect.option,
        Effect.flatMap((maybeMonitorRoles) => {
          if (Option.isNone(maybeMonitorRoles) || maybeMonitorRoles.value.length === 0) {
            return Effect.succeed({
              permissions: [...permissions],
              maybeMember,
            } satisfies ResolvedGuildPermissions);
          }

          const monitorRoleIds = new Set(maybeMonitorRoles.value.map((role) => role.roleId));
          return Option.match(maybeMember, {
            onNone: () =>
              Effect.succeed({
                permissions: [...permissions],
                maybeMember,
              } satisfies ResolvedGuildPermissions),
            onSome: (member) =>
              Effect.succeed({
                permissions: hasMonitorGuildPermission(member, monitorRoleIds)
                  ? appendPermission(permissions, monitorPermission)
                  : [...permissions],
                maybeMember: Option.some(member),
              } satisfies ResolvedGuildPermissions),
          });
        }),
      );
    }),
  );

export const resolveManageGuildScopedPermissions = (
  user: SheetAuthUser["Type"],
  guildId: string,
  membersCache: MembersApiCacheView,
  guildConfigService: GuildConfigService,
  rolesCache: RolesApiCacheView,
): Effect.Effect<Permission[]> =>
  resolveMonitorGuildScopedPermissions(user, guildId, membersCache, guildConfigService).pipe(
    Effect.flatMap(({ permissions, maybeMember }) => {
      if (hasPermission(user.permissions, "bot") || hasPermission(user.permissions, "app_owner")) {
        return Effect.succeed(appendPermissions(permissions, [`manage_guild:${guildId}`]));
      }

      const managePermission = `manage_guild:${guildId}` as const;
      if (permissions.includes(managePermission)) {
        return Effect.succeed([...permissions]);
      }

      if (!permissions.includes(`member_guild:${guildId}`)) {
        return Effect.succeed([...permissions]);
      }

      return rolesCache.getForParent(guildId).pipe(
        Effect.tapError(Effect.logError),
        Effect.option,
        Effect.flatMap((maybeRoles) =>
          Option.match(maybeMember, {
            onNone: () => Effect.succeed([...permissions]),
            onSome: (member) =>
              Option.match(maybeRoles, {
                onNone: () => Effect.succeed([...permissions]),
                onSome: (roles) =>
                  Effect.succeed(
                    hasManageGuildPermission(member, roles)
                      ? appendPermission(permissions, managePermission)
                      : [...permissions],
                  ),
              }),
          }),
        ),
      );
    }),
  );

const resolveMemberGuildPermissions = (user: SheetAuthUser["Type"], guildId: string) =>
  MembersApiCacheView.pipe(
    Effect.flatMap((membersCache) =>
      resolveMemberGuildScopedPermissions(user, guildId, membersCache).pipe(
        Effect.map(({ permissions }) => ({ ...user, permissions })),
      ),
    ),
  );

const resolveMonitorGuildPermissions = (user: SheetAuthUser["Type"], guildId: string) =>
  Effect.all({
    membersCache: MembersApiCacheView,
    guildConfigService: GuildConfigService,
  }).pipe(
    Effect.flatMap(({ membersCache, guildConfigService }) =>
      resolveMonitorGuildScopedPermissions(user, guildId, membersCache, guildConfigService).pipe(
        Effect.map(({ permissions }) => ({ ...user, permissions })),
      ),
    ),
  );

const resolveManageGuildPermissions = (user: SheetAuthUser["Type"], guildId: string) =>
  Effect.all({
    membersCache: MembersApiCacheView,
    guildConfigService: GuildConfigService,
    rolesCache: RolesApiCacheView,
  }).pipe(
    Effect.flatMap(({ membersCache, guildConfigService, rolesCache }) =>
      resolveManageGuildScopedPermissions(
        user,
        guildId,
        membersCache,
        guildConfigService,
        rolesCache,
      ).pipe(Effect.map((permissions) => ({ ...user, permissions }))),
    ),
  );

export const resolveUserGuildPermissions = (user: SheetAuthUser["Type"], guildId: string) =>
  resolveManageGuildPermissions(user, guildId);

export const resolveCurrentMonitorGuildUser = (guildId: string) =>
  SheetAuthUser.pipe(Effect.flatMap((user) => resolveMonitorGuildPermissions(user, guildId)));

export const getGuildMonitorAccessLevel = (user: SheetAuthUser["Type"], guildId: string) =>
  resolveMonitorGuildPermissions(user, guildId).pipe(
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
  predicate: (permissions: ReadonlyArray<Permission>) => boolean,
  message: string,
) =>
  SheetAuthUser.pipe(
    Effect.flatMap((user) =>
      hasPermission(user.permissions, "bot") || hasPermission(user.permissions, "app_owner")
        ? Effect.void
        : (scope === "member"
            ? resolveMemberGuildPermissions(user, guildId)
            : scope === "monitor"
              ? resolveMonitorGuildPermissions(user, guildId)
              : resolveManageGuildPermissions(user, guildId)
          ).pipe(
            Effect.flatMap((resolvedUser) =>
              predicate(resolvedUser.permissions)
                ? Effect.void
                : Effect.fail(new Unauthorized({ message })),
            ),
          ),
    ),
  );

export const requireManageGuild = (
  guildId: string,
  message = "User does not have manage guild permission",
) =>
  requireResolvedGuildPermission(
    guildId,
    "manage",
    (permissions) => hasGuildPermission(permissions, "manage_guild", guildId),
    message,
  );

export const requireMonitorGuild = (
  guildId: string,
  message = "User does not have monitor guild permission",
) =>
  requireResolvedGuildPermission(
    guildId,
    "monitor",
    (permissions) => hasGuildPermission(permissions, "monitor_guild", guildId),
    message,
  );

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

export const requireUserId = (userId: string, message = "User does not have access to this user") =>
  SheetAuthUser.pipe(
    Effect.flatMap((user) =>
      requirePermissions(
        user.permissions,
        (permissions) =>
          hasPermission(permissions, "bot") ||
          hasPermission(permissions, "app_owner") ||
          hasUserPermission(permissions, userId),
        message,
      ),
    ),
  );

export const requireUserIdOrMonitorGuild = (
  guildId: string,
  userId: string,
  message = "User does not have access to this user",
) =>
  SheetAuthUser.pipe(
    Effect.flatMap((user) =>
      hasPermission(user.permissions, "bot") ||
      hasPermission(user.permissions, "app_owner") ||
      hasUserPermission(user.permissions, userId)
        ? Effect.void
        : requireMonitorGuild(guildId, message),
    ),
  );

export const requireGuildMember = (
  guildId: string,
  message = "User is not a member of this guild",
) =>
  requireResolvedGuildPermission(
    guildId,
    "member",
    (permissions) => hasGuildPermission(permissions, "member_guild", guildId),
    message,
  );
