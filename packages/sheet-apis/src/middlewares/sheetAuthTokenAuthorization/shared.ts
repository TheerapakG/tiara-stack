import { Cache, Duration, Effect, Exit, pipe, Redacted } from "effect";
import {
  getAccount,
  getKubernetesOAuthImplicitPermissions,
  type SheetAuthClient as SheetAuthClientValue,
} from "sheet-auth/client";
import type { Permission } from "sheet-auth/plugins/kubernetes-oauth/client";
import { Unauthorized } from "../../schemas/middlewares/unauthorized";
import { SheetAuthTokenAuthorization } from "./tag";

const SUCCESS_TTL = Duration.seconds(30);
const FAILURE_TTL = Duration.seconds(1);

interface CachedAuthorization {
  userId: string;
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
        permissions: permissions.permissions,
      })),
      Effect.mapError((error) => makeUnauthorized(error.message, error.cause)),
    );
  });

export const makeSheetAuthTokenAuthorization = (
  authClient: SheetAuthClientValue,
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
          Effect.map((authorization) => ({
            userId: authorization.userId,
            permissions: authorization.permissions,
            token,
          })),
          Effect.withSpan("SheetAuthTokenAuthorization.sheetAuthToken", {
            captureStackTrace: true,
          }),
        ),
    });
  });
