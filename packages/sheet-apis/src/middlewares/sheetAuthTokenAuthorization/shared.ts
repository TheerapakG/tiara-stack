import { Cache, Duration, Effect, Exit, Option, Redacted } from "effect";
import {
  getAccount,
  getKubernetesOAuthImplicitPermissions,
  type SheetAuthClient as SheetAuthClientValue,
} from "sheet-auth/client";
import type { Permission, PermissionSet } from "@/schemas/permissions";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import {
  appendPermission,
  hasPermission,
  permissionSetFromIterable,
} from "@/services/authorization";
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

const resolveCachedAuthorization = Effect.fn("resolveCachedAuthorization")(function* (
  authClient: SheetAuthClientValue,
  token: Redacted.Redacted<string>,
) {
  const authorizationHeaders = {
    Authorization: `Bearer ${Redacted.value(token)}`,
  };

  const { account, permissions } = yield* Effect.all({
    account: getAccount(authClient, ["discord", "kubernetes:discord"], authorizationHeaders),
    permissions: getKubernetesOAuthImplicitPermissions(authClient, authorizationHeaders).pipe(
      Effect.catch(() => Effect.succeed({ permissions: [] as string[] })),
    ),
  }).pipe(Effect.mapError((error) => makeUnauthorized(error.message, error.cause)));

  const discardedPermissions = permissions.permissions.filter(
    (permission: string) => permission !== "bot",
  );
  if (discardedPermissions.length > 0) {
    yield* Effect.logWarning(
      `Ignoring implicit permissions that are now derived server-side: ${discardedPermissions.join(", ")}`,
    );
  }

  return {
    userId: account.userId,
    accountId: account.accountId,
    permissions: permissions.permissions.some((permission: string) => permission === "bot")
      ? permissionSetFromIterable(["bot"] satisfies Extract<Permission, "bot">[])
      : permissionSetFromIterable([] as Permission[]),
  };
});

const resolveBaseAuthorizationPermissions = Effect.fn("resolveBaseAuthorizationPermissions")(
  function* (
    authorization: CachedAuthorization,
    applicationOwnerResolver: {
      getOwnerId: () => Effect.Effect<Option.Option<string>, never, never>;
    },
  ) {
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
  },
);

export const makeSheetAuthTokenAuthorization = Effect.fn("makeSheetAuthTokenAuthorization")(
  function* (
    authClient: SheetAuthClientValue,
    applicationOwnerResolver: {
      getOwnerId: () => Effect.Effect<Option.Option<string>, never, never>;
    },
  ) {
    const authorizationCache = yield* Cache.makeWith(
      (token: Redacted.Redacted<string>) => resolveCachedAuthorization(authClient, token),
      {
        capacity: Infinity,
        timeToLive: Exit.match({
          onFailure: () => FAILURE_TTL,
          onSuccess: () => SUCCESS_TTL,
        }),
      },
    );

    return SheetAuthTokenAuthorization.of({
      sheetAuthToken: Effect.fn("SheetAuthTokenAuthorization.sheetAuthToken")(function* (
        httpEffect,
        { credential },
      ) {
        const authorization = yield* Cache.get(authorizationCache, credential);
        const permissions = yield* resolveBaseAuthorizationPermissions(
          authorization,
          applicationOwnerResolver,
        );

        return yield* Effect.provideService(httpEffect, SheetAuthUser, {
          accountId: authorization.accountId,
          userId: authorization.userId,
          permissions,
          token: credential,
        });
      }),
    });
  },
);
