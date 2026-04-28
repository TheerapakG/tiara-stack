import {
  Cache,
  Clock,
  Duration,
  Effect,
  Exit,
  HashSet,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import { Headers } from "effect/unstable/http";
import { verifyKubernetesToken } from "sheet-auth/plugins/kubernetes-oauth";
import { SheetApisRpcAuthorization } from "sheet-ingress-api/middlewares/sheetApisRpcAuthorization/tag";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "sheet-ingress-api/schemas/middlewares/unauthorized";
import { Permission } from "sheet-ingress-api/schemas/permissions";
import { config } from "@/config";
import { ForwardedDiscordAccessToken } from "../forwardedDiscordAccessToken/tag";

// Ingress-forwarded users are already authenticated at the boundary. The raw
// sheet-auth session token is intentionally unavailable inside sheet-apis.
const forwardedSessionTokenUnavailable = Redacted.make("ingress-forwarded-token-unavailable");

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

const getBearerToken = (authorization: string | undefined) => {
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length === 0 ? undefined : token;
};

type VerifiedIngressToken = {
  readonly exp: number | undefined;
  readonly ttl: Duration.Duration;
};

type SheetApisRpcAuthorizationMiddleware = Parameters<typeof SheetApisRpcAuthorization.of>[0];

const requireUnexpiredVerifiedToken = ({ exp }: { readonly exp: number | undefined }) =>
  typeof exp === "number"
    ? Clock.currentTimeMillis.pipe(
        Effect.flatMap((now) =>
          now < exp * 1000
            ? Effect.void
            : Effect.fail(new Unauthorized({ message: "Expired ingress Kubernetes token" })),
        ),
      )
    : Effect.void;

export const SheetAuthTokenAuthorizationLive = Layer.effect(
  SheetApisRpcAuthorization,
  Effect.gen(function* () {
    const podNamespace = yield* config.podNamespace;
    const maybeIngressNamespace = yield* config.sheetIngressNamespace;
    const ingressNamespace = Option.getOrElse(maybeIngressNamespace, () => podNamespace);
    const audience = yield* config.sheetIngressKubernetesAudience;
    const expectedSubject = `system:serviceaccount:${ingressNamespace}:sheet-ingress-server`;
    // 100 entries covers normal 5-minute projected token rotation with headroom
    // while still bounding distinct invalid/old token pressure.
    const ingressTokenCache = yield* Cache.makeWith(
      (token: string) =>
        Effect.tryPromise({
          try: () => verifyKubernetesToken(token, audience),
          catch: (cause) =>
            new Unauthorized({ message: "Invalid ingress Kubernetes token", cause }),
        }).pipe(
          Effect.flatMap(({ exp, sub }) =>
            sub === expectedSubject
              ? Clock.currentTimeMillis.pipe(
                  Effect.map((now) => ({
                    exp,
                    ttl:
                      typeof exp === "number"
                        ? Duration.min(
                            Duration.minutes(5),
                            Duration.millis(Math.max(0, exp * 1000 - now)),
                          )
                        : Duration.minutes(5),
                  })),
                )
              : Effect.fail(
                  new Unauthorized({
                    message: `Invalid ingress Kubernetes token subject: ${sub}`,
                  }),
                ),
          ),
        ),
      {
        capacity: 100,
        timeToLive: Exit.match({
          onFailure: () => Duration.seconds(1),
          onSuccess: ({ ttl }: VerifiedIngressToken) => ttl,
        }),
      },
    );

    const middleware: SheetApisRpcAuthorizationMiddleware = Effect.fn("SheetApisRpcAuthorization")(
      function* (rpcEffect, options) {
        const headers = options.headers;
        const ingressToken = getBearerToken(
          Option.getOrUndefined(Headers.get(headers, "x-sheet-ingress-auth")),
        );

        if (!ingressToken) {
          return yield* Effect.fail(new Unauthorized({ message: "Missing ingress authorization" }));
        }
        const verifiedToken = yield* Cache.get(ingressTokenCache, ingressToken);
        yield* requireUnexpiredVerifiedToken(verifiedToken);

        const userId = Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-user-id"));
        const accountId = Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-account-id"));

        if (!userId || !accountId) {
          return yield* Effect.fail(new Unauthorized({ message: "Missing forwarded auth user" }));
        }

        const permissions = yield* parsePermissions(
          Option.getOrUndefined(Headers.get(headers, "x-sheet-auth-permissions")),
        );
        const forwardedDiscordAccessToken = Option.map(
          Headers.get(headers, "x-sheet-discord-access-token"),
          Redacted.make,
        );

        const provided = rpcEffect.pipe(
          Effect.provideService(SheetAuthUser, {
            accountId,
            userId,
            permissions,
            token: forwardedSessionTokenUnavailable,
          }),
          Effect.provideService(ForwardedDiscordAccessToken, forwardedDiscordAccessToken),
        );

        return yield* provided;
      },
    );

    return SheetApisRpcAuthorization.of(middleware);
  }),
);
