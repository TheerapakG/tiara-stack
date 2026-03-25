import { Discord, Perms } from "dfx";
import { Cache, Duration, Effect, Exit, Option, pipe, Redacted } from "effect";
import type { MembersApiCacheView, RolesApiCacheView } from "dfx-discord-utils/discord";
import {
  getAccount,
  getKubernetesOAuthImplicitPermissions,
  type SheetAuthClient as SheetAuthClientValue,
} from "sheet-auth/client";
import type { Permission } from "@/schemas/permissions";
import type { GuildConfigService } from "../../services/guildConfig";
import type { ApplicationOwnerResolver } from "../../services/applicationOwner";
import { getOptionalGuildId } from "../requestGuildId";
import { Unauthorized } from "../../schemas/middlewares/unauthorized";
import { SheetAuthTokenAuthorization } from "./tag";

const SUCCESS_TTL = Duration.seconds(30);
const FAILURE_TTL = Duration.seconds(1);

interface CachedAuthorization {
  userId: string;
  accountId: string;
  permissions: Permission[];
}

const makeUnauthorized = (message: string, cause?: unknown) =>
  new Unauthorized({
    message: `Invalid sheet-auth token: ${message}`,
    cause,
  });

const resolveCachedAuthorization = (
  authClient: SheetAuthClientValue,
  token: Redacted.Redacted<string>,
): Effect.Effect<CachedAuthorization, Unauthorized> =>
  Effect.gen(function* () {
    const authorizationHeaders = {
      Authorization: `Bearer ${Redacted.value(token)}`,
    };

    const { account, permissions } = yield* Effect.all({
      account: getAccount(authClient, ["discord", "kubernetes:discord"], authorizationHeaders),
      permissions: getKubernetesOAuthImplicitPermissions(authClient, authorizationHeaders).pipe(
        Effect.catchAll(() => Effect.succeed({ permissions: [] })),
      ),
    }).pipe(Effect.mapError((error) => makeUnauthorized(error.message, error.cause)));

    const discardedPermissions = permissions.permissions.filter(
      (permission) => permission !== "bot",
    );
    if (discardedPermissions.length > 0) {
      yield* Effect.logWarning(
        `Ignoring implicit permissions that are now derived server-side: ${discardedPermissions.join(", ")}`,
      );
    }

    return {
      userId: account.userId,
      accountId: account.accountId,
      permissions: permissions.permissions.some((permission) => permission === "bot")
        ? (["bot"] satisfies Extract<Permission, "bot">[])
        : ([] satisfies Extract<Permission, "bot">[]),
    };
  });

// Resolve guild-scoped permissions for requests that include `guildId`.
// Endpoints can then introspect these permissions to decide how to handle
// monitor-specific access without re-running guild membership checks.
const appendPermission = (
  permissions: ReadonlyArray<Permission>,
  permission: Permission,
): Permission[] =>
  permissions.includes(permission) ? [...permissions] : [...permissions, permission];

const appendPermissions = (
  permissions: ReadonlyArray<Permission>,
  nextPermissions: ReadonlyArray<Permission>,
): Permission[] => nextPermissions.reduce(appendPermission, [...permissions]);

const hasPermission = (permissions: ReadonlyArray<Permission>, permission: Permission) =>
  permissions.includes(permission);

const resolvePermissions = (
  authorization: CachedAuthorization,
  applicationOwnerResolver: ApplicationOwnerResolver,
  guildConfigService: GuildConfigService,
  membersCache: MembersApiCacheView,
  rolesCache: RolesApiCacheView,
): Effect.Effect<Permission[]> =>
  Effect.gen(function* () {
    let permissions = appendPermission(authorization.permissions, `user:${authorization.userId}`);

    if (hasPermission(permissions, "bot")) {
      return permissions;
    }

    const maybeOwnerId = yield* applicationOwnerResolver.getOwnerId().pipe(
      Effect.tapError(Effect.logError),
      Effect.orElseSucceed(() => Option.none<string>()),
    );
    if (Option.isSome(maybeOwnerId) && maybeOwnerId.value === authorization.userId) {
      permissions = appendPermission(permissions, "app_owner");
      const maybeGuildId = yield* getOptionalGuildId;
      return Option.isSome(maybeGuildId)
        ? appendPermissions(permissions, [
            `member_guild:${maybeGuildId.value}`,
            `monitor_guild:${maybeGuildId.value}`,
            `manage_guild:${maybeGuildId.value}`,
          ])
        : permissions;
    }

    const maybeGuildId = yield* getOptionalGuildId;
    if (Option.isNone(maybeGuildId)) {
      return permissions;
    }

    const memberPermission = `member_guild:${maybeGuildId.value}` as const;
    const monitorPermission = `monitor_guild:${maybeGuildId.value}` as const;
    const managePermission = `manage_guild:${maybeGuildId.value}` as const;
    const needsMemberPermission = !permissions.includes(memberPermission);
    const needsMonitorPermission = !permissions.includes(monitorPermission);
    const needsManagePermission = !permissions.includes(managePermission);
    if (!needsMemberPermission && !needsMonitorPermission && !needsManagePermission) {
      return permissions;
    }

    const guildId = maybeGuildId.value;
    const maybeMember = yield* membersCache
      .get(guildId, authorization.accountId)
      .pipe(Effect.tapError(Effect.logError), Effect.option);
    if (Option.isNone(maybeMember)) {
      return permissions;
    }

    if (needsMemberPermission) {
      permissions = appendPermission(permissions, memberPermission);
    }

    if (needsMonitorPermission) {
      const maybeMonitorRoles = yield* guildConfigService
        .getGuildMonitorRoles(guildId)
        .pipe(Effect.tapError(Effect.logError), Effect.option);
      if (Option.isSome(maybeMonitorRoles) && maybeMonitorRoles.value.length > 0) {
        const monitorRoleIds = new Set(maybeMonitorRoles.value.map((role) => role.roleId));
        if (maybeMember.value.roles.some((roleId) => monitorRoleIds.has(roleId))) {
          permissions = appendPermission(permissions, monitorPermission);
        }
      }
    }

    if (needsManagePermission) {
      const maybeRoles = yield* rolesCache
        .getForParent(guildId)
        .pipe(Effect.tapError(Effect.logError), Effect.option);
      if (Option.isSome(maybeRoles)) {
        const memberWithMetadata = maybeMember.value as typeof maybeMember.value & {
          flags?: number;
          joined_at?: string;
        };
        const memberForPermissionCheck = {
          ...maybeMember.value,
          flags: memberWithMetadata.flags ?? 0,
          joined_at: memberWithMetadata.joined_at ?? "",
          mute: false,
          deaf: false,
          pending: maybeMember.value.pending ?? false,
        };
        const resolvedUserPermissions = Perms.forMember([...maybeRoles.value.values()])(
          memberForPermissionCheck,
        );
        if (Perms.has(Discord.Permissions.ManageGuild)(resolvedUserPermissions)) {
          permissions = appendPermission(permissions, managePermission);
        }
      }
    }

    return permissions;
  });

export const makeSheetAuthTokenAuthorization = (
  authClient: SheetAuthClientValue,
  applicationOwnerResolver: ApplicationOwnerResolver,
  guildConfigService: GuildConfigService,
  membersCache: MembersApiCacheView,
  rolesCache: RolesApiCacheView,
): Effect.Effect<SheetAuthTokenAuthorization["Type"]> =>
  Effect.gen(function* () {
    const authorizationCache = yield* Cache.makeWith({
      capacity: Infinity,
      lookup: (token: Redacted.Redacted<string>) => resolveCachedAuthorization(authClient, token),
      timeToLive: Exit.match({
        onFailure: () => FAILURE_TTL,
        onSuccess: () => SUCCESS_TTL,
      }),
    });

    return SheetAuthTokenAuthorization.of({
      sheetAuthToken: (token) =>
        pipe(
          authorizationCache.get(token),
          Effect.flatMap((authorization) =>
            resolvePermissions(
              authorization,
              applicationOwnerResolver,
              guildConfigService,
              membersCache,
              rolesCache,
            ).pipe(
              Effect.map((permissions) => ({
                accountId: authorization.accountId,
                userId: authorization.userId,
                permissions,
                token,
              })),
            ),
          ),
          Effect.withSpan("SheetAuthTokenAuthorization.sheetAuthToken", {
            captureStackTrace: true,
          }),
        ),
    });
  });
