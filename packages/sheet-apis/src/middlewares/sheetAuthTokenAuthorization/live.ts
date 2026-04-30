import { Effect, HashSet, Layer, Option, Redacted, Schema } from "effect";
import { Headers } from "effect/unstable/http";
import {
  getBearerToken,
  makeKubernetesServiceAccountTokenAuthorizer,
} from "sheet-auth/plugins/kubernetes-oauth/rpc-authorization";
import { SheetApisRpcAuthorization } from "sheet-ingress-api/middlewares/sheetApisRpcAuthorization/tag";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "typhoon-core/error";
import { Permission } from "sheet-ingress-api/schemas/permissions";
import { config } from "@/config";
import { SHEET_AUTH_SESSION_TOKEN_UNAVAILABLE } from "@/services/discordAccessToken";

// Some internal calls, such as service/anonymous requests, do not carry a
// user-scoped sheet-auth session token.
const forwardedSessionTokenUnavailable = Redacted.make(SHEET_AUTH_SESSION_TOKEN_UNAVAILABLE);

const parsePermissions = (permissions: string | undefined) =>
  Effect.forEach(
    permissions?.split(",").filter((permission) => permission.length > 0) ?? [],
    (permission) => Schema.decodeUnknownEffect(Permission)(permission),
  ).pipe(
    Effect.map((values) => HashSet.fromIterable(values)),
    Effect.mapError(
      (cause) => new Unauthorized({ message: "Invalid forwarded auth permissions", cause }),
    ),
  );

type SheetApisRpcAuthorizationMiddleware = Parameters<typeof SheetApisRpcAuthorization.of>[0];

export const SheetAuthTokenAuthorizationLive = Layer.effect(
  SheetApisRpcAuthorization,
  Effect.gen(function* () {
    const podNamespace = yield* config.podNamespace;
    const maybeIngressNamespace = yield* config.sheetIngressNamespace;
    const ingressNamespace = Option.getOrElse(maybeIngressNamespace, () => podNamespace);
    const audience = yield* config.sheetIngressKubernetesAudience;
    const authorizer = yield* makeKubernetesServiceAccountTokenAuthorizer({
      audience,
      expectedNamespace: ingressNamespace,
      expectedServiceAccountName: "sheet-ingress-server",
    });

    const middleware: SheetApisRpcAuthorizationMiddleware = Effect.fn("SheetApisRpcAuthorization")(
      function* (rpcEffect, options) {
        const headers = options.headers;
        yield* authorizer.requireAuthorizedHeaders(headers);

        const userId = Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-user-id"));
        const accountId = Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-account-id"));

        if (!userId || !accountId) {
          return yield* Effect.fail(new Unauthorized({ message: "Missing forwarded auth user" }));
        }

        const permissions = yield* parsePermissions(
          Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-permissions")),
        );
        const sessionToken = getBearerToken(
          Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-session-token")),
        );

        const provided = rpcEffect.pipe(
          Effect.provideService(SheetAuthUser, {
            accountId,
            userId,
            permissions,
            token: sessionToken ? Redacted.make(sessionToken) : forwardedSessionTokenUnavailable,
          }),
        );

        return yield* provided;
      },
    );

    return SheetApisRpcAuthorization.of(middleware);
  }),
);
