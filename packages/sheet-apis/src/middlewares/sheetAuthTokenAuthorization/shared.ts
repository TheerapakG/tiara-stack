import { Cache, Duration, Effect, Exit, Option, pipe, Redacted } from "effect";
import {
  getAccount,
  getKubernetesOAuthImplicitPermissions,
  type SheetAuthClient as SheetAuthClientValue,
} from "sheet-auth/client";
import type { Permission, PermissionSet } from "@/schemas/permissions";
import { appendPermission, hasPermission, permissionSetFromIterable } from "../authorization";
import type { ApplicationOwnerResolver } from "../../services/applicationOwner";
import { Unauthorized } from "../../schemas/middlewares/unauthorized";
import { SheetAuthTokenAuthorization } from "./tag";

const SUCCESS_TTL = Duration.seconds(30);
const FAILURE_TTL = Duration.seconds(1);

interface CachedAuthorization {
  userId: string;
  accountId: string;
  permissions: PermissionSet;
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
        ? permissionSetFromIterable(["bot"] satisfies Extract<Permission, "bot">[])
        : permissionSetFromIterable([] as Permission[]),
    };
  });

const resolveBaseAuthorizationPermissions = (
  authorization: CachedAuthorization,
  applicationOwnerResolver: ApplicationOwnerResolver,
): Effect.Effect<PermissionSet> =>
  Effect.gen(function* () {
    let permissions = appendPermission(
      authorization.permissions,
      `account:discord:${authorization.accountId}`,
    );

    if (hasPermission(permissions, "bot")) {
      return permissions;
    }

    const maybeOwnerId = yield* applicationOwnerResolver.getOwnerId().pipe(
      Effect.tapError(Effect.logError),
      Effect.orElseSucceed(() => Option.none<string>()),
    );
    if (Option.isSome(maybeOwnerId) && maybeOwnerId.value === authorization.accountId) {
      permissions = appendPermission(permissions, "app_owner");
    }

    return permissions;
  });

export const makeSheetAuthTokenAuthorization = (
  authClient: SheetAuthClientValue,
  applicationOwnerResolver: ApplicationOwnerResolver,
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
            resolveBaseAuthorizationPermissions(authorization, applicationOwnerResolver).pipe(
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
