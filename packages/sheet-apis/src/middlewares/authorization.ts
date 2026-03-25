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

const hasPermission = (permissions: ReadonlyArray<Permission>, permission: Permission) =>
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

const getRequiredGuildMember = (
  guildId: string,
  accountId: string,
  membersCache: MembersApiCacheView,
  message: string,
) =>
  membersCache
    .get(guildId, accountId)
    .pipe(
      Effect.catchAll((error) =>
        error instanceof CacheNotFoundError
          ? Effect.fail(new Unauthorized({ message }))
          : Effect.die(error),
      ),
    );

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

const getLiveGuildMonitorAccessLevel = (
  user: SheetAuthUser["Type"],
  guildId: string,
  membersCache: MembersApiCacheView,
  guildConfigService: GuildConfigService,
) =>
  membersCache.get(guildId, user.accountId).pipe(
    Effect.map(Option.some),
    Effect.catchAll((error) =>
      error instanceof CacheNotFoundError ? Effect.succeed(Option.none()) : Effect.die(error),
    ),
    Effect.flatMap((member) =>
      member._tag === "None"
        ? Effect.succeed<"monitor" | "member" | "none">("none")
        : guildConfigService.getGuildMonitorRoles(guildId).pipe(
            Effect.map((roles) => new Set(roles.map((role) => role.roleId))),
            Effect.map((monitorRoleIds) =>
              hasMonitorGuildPermission(member.value, monitorRoleIds) ? "monitor" : "member",
            ),
          ),
    ),
  );

export const getGuildMonitorAccessLevel = (
  user: SheetAuthUser["Type"],
  guildId: string,
  membersCache: MembersApiCacheView,
  guildConfigService: GuildConfigService,
) =>
  hasPermission(user.permissions, "bot") ||
  hasPermission(user.permissions, "app_owner") ||
  hasGuildPermission(user.permissions, "monitor_guild", guildId)
    ? Effect.succeed<"monitor" | "member" | "none">("monitor")
    : getLiveGuildMonitorAccessLevel(user, guildId, membersCache, guildConfigService);

export const requireManageGuild = (
  guildId: string,
  message = "User does not have manage guild permission",
) =>
  SheetAuthUser.pipe(
    Effect.flatMap((user) =>
      hasPermission(user.permissions, "bot") ||
      hasPermission(user.permissions, "app_owner") ||
      hasGuildPermission(user.permissions, "manage_guild", guildId)
        ? Effect.void
        : Effect.all({
            membersCache: MembersApiCacheView,
            rolesCache: RolesApiCacheView,
          }).pipe(
            Effect.flatMap(({ membersCache, rolesCache }) =>
              getRequiredGuildMember(guildId, user.accountId, membersCache, message).pipe(
                Effect.flatMap((member) =>
                  rolesCache.getForParent(guildId).pipe(
                    Effect.catchAll((error) =>
                      error instanceof CacheNotFoundError
                        ? Effect.fail(new Unauthorized({ message }))
                        : Effect.die(error),
                    ),
                    Effect.flatMap((roles) =>
                      hasManageGuildPermission(member, roles)
                        ? Effect.void
                        : Effect.fail(new Unauthorized({ message })),
                    ),
                  ),
                ),
              ),
            ),
          ),
    ),
  );

export const requireMonitorGuild = (
  guildId: string,
  message = "User does not have monitor guild permission",
) =>
  SheetAuthUser.pipe(
    Effect.flatMap((user) =>
      hasPermission(user.permissions, "bot") ||
      hasPermission(user.permissions, "app_owner") ||
      hasGuildPermission(user.permissions, "monitor_guild", guildId)
        ? Effect.void
        : Effect.all({
            membersCache: MembersApiCacheView,
            guildConfigService: GuildConfigService,
          }).pipe(
            Effect.flatMap(({ membersCache, guildConfigService }) =>
              getLiveGuildMonitorAccessLevel(user, guildId, membersCache, guildConfigService).pipe(
                Effect.flatMap((accessLevel) =>
                  accessLevel === "monitor"
                    ? Effect.void
                    : Effect.fail(new Unauthorized({ message })),
                ),
              ),
            ),
          ),
    ),
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
  Effect.all({
    user: SheetAuthUser,
    membersCache: MembersApiCacheView,
  }).pipe(
    Effect.flatMap(({ user, membersCache }) =>
      hasPermission(user.permissions, "bot") ||
      hasPermission(user.permissions, "app_owner") ||
      hasGuildPermission(user.permissions, "member_guild", guildId)
        ? Effect.void
        : membersCache.get(guildId, user.accountId).pipe(
            Effect.map(Option.some),
            Effect.catchAll((error) =>
              error instanceof CacheNotFoundError
                ? Effect.succeed(Option.none())
                : Effect.die(error),
            ),
            Effect.flatMap((isMember) =>
              isMember._tag === "Some" ? Effect.void : Effect.fail(new Unauthorized({ message })),
            ),
          ),
    ),
  );
