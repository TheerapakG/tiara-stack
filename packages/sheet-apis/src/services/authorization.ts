import { MembersApiCacheView } from "dfx-discord-utils/discord/cache/members";
import { RolesApiCacheView } from "dfx-discord-utils/discord/cache/roles";
import { CacheNotFoundError } from "dfx-discord-utils/discord/schema";
import type { CachedGuildMember } from "dfx-discord-utils/cache";
import { Discord, Perms } from "dfx";
import { Effect, HashSet, Layer, Option, ServiceMap } from "effect";
import type { Permission, PermissionSet } from "@/schemas/permissions";
import { SheetAuthGuildUser } from "@/schemas/middlewares/sheetAuthGuildUser";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { GuildConfigService } from "./guildConfig";
import { discordLayer } from "./discord";

type SheetAuthUserType = (typeof SheetAuthUser)["Type"];
type SheetAuthGuildUserType = (typeof SheetAuthGuildUser)["Type"];

type GuildPermissionScope = "member" | "monitor" | "manage";

interface ResolvedGuildPermissions {
  permissions: PermissionSet;
  maybeMember: Option.Option<CachedGuildMember>;
}

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

const makeSheetAuthGuildUser = (
  user: SheetAuthUserType,
  guildId: string,
  permissions: PermissionSet,
): SheetAuthGuildUserType => ({
  accountId: user.accountId,
  userId: user.userId,
  guildId,
  permissions,
  token: user.token,
});

const provideResolvedGuildUser = <A, E, R, R2>(
  resolvedGuildUser: Effect.Effect<SheetAuthGuildUserType, never, R2>,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R | R2, typeof SheetAuthGuildUser>> =>
  resolvedGuildUser.pipe(
    Effect.flatMap((user) => effect.pipe(Effect.provideService(SheetAuthGuildUser, user))),
    // Safe cast: provideService satisfies SheetAuthGuildUser for downstream effects,
    // but TypeScript does not remove the requirement from R automatically.
  ) as Effect.Effect<A, E, Exclude<R | R2, typeof SheetAuthGuildUser>>;

export class AuthorizationService extends ServiceMap.Service<AuthorizationService>()(
  "AuthorizationService",
  {
    make: Effect.gen(function* () {
      const membersCache = yield* MembersApiCacheView;
      const guildConfigService = yield* GuildConfigService;
      const rolesCache = yield* RolesApiCacheView;

      const getOptionalGuildMember = (guildId: string, accountId: string) =>
        membersCache.get(guildId, accountId).pipe(
          Effect.map(Option.some),
          Effect.catch((error) => {
            if (error instanceof CacheNotFoundError) {
              return Effect.succeed(Option.none());
            }

            return Effect.logError(error).pipe(Effect.as(Option.none()));
          }),
        );

      const getOptionalMonitorRoleIds = (guildId: string) =>
        guildConfigService
          .getGuildMonitorRoles(guildId)
          .pipe(
            Effect.tapError(Effect.logError),
            Effect.option,
            Effect.map(
              Option.map(
                (monitorRoles) =>
                  new Set(monitorRoles.map((role) => role.roleId)) as ReadonlySet<string>,
              ),
            ),
          );

      const getOptionalGuildRoles = (guildId: string) =>
        rolesCache.getForParent(guildId).pipe(Effect.tapError(Effect.logError), Effect.option);

      const resolveGuildScopedPermissions = (user: SheetAuthUserType, guildId: string) =>
        Effect.gen(function* () {
          if (
            hasPermission(user.permissions, "bot") ||
            hasPermission(user.permissions, "app_owner")
          ) {
            return {
              permissions: appendPermissions(user.permissions, [
                `member_guild:${guildId}`,
                `monitor_guild:${guildId}`,
                `manage_guild:${guildId}`,
              ]),
              maybeMember: Option.none(),
            } satisfies ResolvedGuildPermissions;
          }

          const [maybeMember, maybeMonitorRoleIds, maybeRoles] = yield* Effect.all(
            [
              getOptionalGuildMember(guildId, user.accountId),
              getOptionalMonitorRoleIds(guildId),
              getOptionalGuildRoles(guildId),
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

      const resolveSheetAuthGuildUser = (user: SheetAuthUserType, guildId: string) =>
        resolveGuildScopedPermissions(user, guildId).pipe(
          Effect.map(({ permissions }) => makeSheetAuthGuildUser(user, guildId, permissions)),
        );

      const resolveCurrentGuildUser = (guildId: string) =>
        Effect.gen(function* () {
          const user = yield* SheetAuthUser;
          return yield* resolveSheetAuthGuildUser(user, guildId);
        });

      const provideCurrentGuildUser = <A, E, R>(guildId: string, effect: Effect.Effect<A, E, R>) =>
        provideResolvedGuildUser(resolveCurrentGuildUser(guildId), effect);

      const getRequiredCurrentGuildUser = (guildId: string) =>
        Effect.gen(function* () {
          const user = yield* SheetAuthGuildUser;

          if (user.guildId === guildId) {
            return user;
          }

          return yield* Effect.die(
            new Error(
              `SheetAuthGuildUser guild mismatch: expected ${guildId}, received ${user.guildId}`,
            ),
          );
        });

      const getGuildMonitorAccessLevel = (user: SheetAuthUserType, guildId: string) =>
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

      return {
        resolveSheetAuthGuildUser,
        provideCurrentGuildUser,
        getGuildMonitorAccessLevel,
        requireManageGuild: (
          guildId: string,
          message = "User does not have manage guild permission",
        ) => requireResolvedGuildPermission(guildId, "manage", message),
        requireMonitorGuild: (
          guildId: string,
          message = "User does not have monitor guild permission",
        ) => requireResolvedGuildPermission(guildId, "monitor", message),
        requireBot: (message = "User is not the bot") =>
          Effect.gen(function* () {
            const user = yield* SheetAuthUser;

            return yield* requirePermissions(
              user.permissions,
              (permissions) => hasPermission(permissions, "bot"),
              message,
            );
          }),
        requireDiscordAccountId: (
          accountId: string,
          message = "User does not have access to this user",
        ) =>
          Effect.gen(function* () {
            const user = yield* SheetAuthUser;

            return yield* requirePermissions(
              user.permissions,
              (permissions) =>
                hasPermission(permissions, "bot") ||
                hasPermission(permissions, "app_owner") ||
                hasDiscordAccountPermission(permissions, accountId),
              message,
            );
          }),
        requireDiscordAccountIdOrMonitorGuild: (
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
          ),
        requireGuildMember: (guildId: string, message = "User is not a member of this guild") =>
          requireResolvedGuildPermission(guildId, "member", message),
      };
    }),
  },
) {
  static layer = Layer.effect(AuthorizationService, this.make).pipe(
    Layer.provide([GuildConfigService.layer, discordLayer]),
  );
}
