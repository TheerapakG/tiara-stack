import { HttpServerRequest } from "@effect/platform";
import { Discord, Perms } from "dfx";
import { Cache, Duration, Effect, Exit, Option, pipe, Redacted } from "effect";
import type { MembersApiCacheView, RolesApiCacheView } from "dfx-discord-utils/discord";
import {
  getAccount,
  getKubernetesOAuthImplicitPermissions,
  type SheetAuthClient as SheetAuthClientValue,
} from "sheet-auth/client";
import type { Permission } from "sheet-auth/plugins/kubernetes-oauth/client";
import type { GuildConfigService } from "../../services/guildConfig";
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

    return yield* Effect.all({
      account: getAccount(authClient, ["discord", "kubernetes:discord"], authorizationHeaders),
      permissions: getKubernetesOAuthImplicitPermissions(authClient, authorizationHeaders).pipe(
        Effect.catchAll(() => Effect.succeed({ permissions: [] })),
      ),
    }).pipe(
      Effect.map(({ account, permissions }) => ({
        userId: account.userId,
        accountId: account.accountId,
        permissions: permissions.permissions,
      })),
      Effect.mapError((error) => makeUnauthorized(error.message, error.cause)),
    );
  });

const getOptionalGuildId = pipe(
  Effect.serviceOption(HttpServerRequest.ParsedSearchParams),
  Effect.map(
    Option.flatMap((searchParams) => {
      const guildId = searchParams.guildId;
      return typeof guildId === "string" ? Option.some(guildId) : Option.none();
    }),
  ),
);

// Resolve guild-scoped permissions for requests that include `guildId`.
// Endpoints can then introspect these permissions to decide how to handle
// monitor-specific access without re-running guild membership checks.
const appendPermission = (
  permissions: ReadonlyArray<Permission>,
  permission: Permission,
): Permission[] =>
  permissions.includes(permission) ? [...permissions] : [...permissions, permission];

const resolvePermissions = (
  authorization: CachedAuthorization,
  guildConfigService: GuildConfigService,
  membersCache: MembersApiCacheView,
  rolesCache: RolesApiCacheView,
): Effect.Effect<Permission[]> =>
  Effect.gen(function* () {
    const maybeGuildId = yield* getOptionalGuildId;
    if (Option.isNone(maybeGuildId)) {
      return authorization.permissions;
    }

    const needsMonitorPermission = !authorization.permissions.includes("monitor_guild");
    const needsManagePermission = !authorization.permissions.includes("manage_guild");
    if (!needsMonitorPermission && !needsManagePermission) {
      return authorization.permissions;
    }

    const guildId = maybeGuildId.value;
    const maybeMember = yield* membersCache
      .get(guildId, authorization.accountId)
      .pipe(Effect.tapError(Effect.logError), Effect.option);
    if (Option.isNone(maybeMember)) {
      return authorization.permissions;
    }

    let permissions = [...authorization.permissions];

    if (needsMonitorPermission) {
      const maybeMonitorRoles = yield* guildConfigService
        .getGuildMonitorRoles(guildId)
        .pipe(Effect.tapError(Effect.logError), Effect.option);
      if (Option.isSome(maybeMonitorRoles) && maybeMonitorRoles.value.length > 0) {
        const monitorRoleIds = new Set(maybeMonitorRoles.value.map((role) => role.roleId));
        if (maybeMember.value.roles.some((roleId) => monitorRoleIds.has(roleId))) {
          permissions = appendPermission(permissions, "monitor_guild");
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
          permissions = appendPermission(permissions, "manage_guild");
        }
      }
    }

    return permissions;
  });

export const makeSheetAuthTokenAuthorization = (
  authClient: SheetAuthClientValue,
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
            resolvePermissions(authorization, guildConfigService, membersCache, rolesCache).pipe(
              Effect.map((permissions) => ({
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
