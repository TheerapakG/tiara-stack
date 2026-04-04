import { Cache, Duration, Effect, Exit, Option, Redacted, ServiceMap } from "effect";
import {
  getAccount,
  getKubernetesOAuthImplicitPermissions,
  type SheetAuthClient as SheetAuthClientValue,
} from "sheet-auth/client";
import type { Permission, PermissionSet } from "@/schemas/permissions";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { appendPermission, hasPermission, permissionSetFromIterable } from "../authorization";
import { Unauthorized } from "../../schemas/middlewares/unauthorized";
import { SheetAuthTokenAuthorization } from "./tag";

const SUCCESS_TTL = Duration.seconds(30);
const FAILURE_TTL = Duration.seconds(1);
const sheetAuthUserTag = SheetAuthUser as ServiceMap.Reference<(typeof SheetAuthUser)["Type"]>;

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
) =>
  Effect.gen(function* () {
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

const resolveBaseAuthorizationPermissions = (
  authorization: CachedAuthorization,
  applicationOwnerResolver: {
    getOwnerId: () => Effect.Effect<Option.Option<string>, never, never>;
  },
) =>
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
  applicationOwnerResolver: {
    getOwnerId: () => Effect.Effect<Option.Option<string>, never, never>;
  },
) =>
  Effect.gen(function* () {
    const authorizationCache = yield* Cache.makeWith({
      capacity: Infinity,
      lookup: (token: Redacted.Redacted<string>) => resolveCachedAuthorization(authClient, token),
      timeToLive: Exit.match({
        onFailure: () => FAILURE_TTL,
        onSuccess: () => SUCCESS_TTL,
      }),
    });

    const sheetAuthToken = ((httpEffect, { credential }) =>
      Effect.gen(function* () {
        const authorization = yield* Cache.get(authorizationCache, credential);
        const permissions = yield* resolveBaseAuthorizationPermissions(
          authorization,
          applicationOwnerResolver,
        );

        const authorizedHttpEffect = Effect.provideService(
          httpEffect as unknown as Effect.Effect<unknown, never, typeof sheetAuthUserTag>,
          sheetAuthUserTag,
          {
            accountId: authorization.accountId,
            userId: authorization.userId,
            permissions,
            token: credential,
          },
        ) as unknown as Effect.Effect<unknown, never, never>;

        return yield* Effect.withSpan(
          authorizedHttpEffect,
          "SheetAuthTokenAuthorization.sheetAuthToken",
          { captureStackTrace: true },
        );
      })) as ReturnType<typeof SheetAuthTokenAuthorization.of>["sheetAuthToken"];

    return SheetAuthTokenAuthorization.of({
      sheetAuthToken,
    });
  });
