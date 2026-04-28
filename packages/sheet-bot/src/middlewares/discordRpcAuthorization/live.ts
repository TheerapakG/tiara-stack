import { Cache, Clock, Duration, Effect, Exit, Layer, Option } from "effect";
import { Headers } from "effect/unstable/http";
import { Unauthorized as SheetBotUnauthorized } from "dfx-discord-utils/discord/schema";
import { verifyKubernetesToken } from "sheet-auth/plugins/kubernetes-oauth";
import { SheetBotRpcAuthorization } from "sheet-ingress-api/middlewares/sheetBotRpcAuthorization/tag";
import { config } from "@/config";

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

type SheetBotRpcAuthorizationMiddleware = Parameters<typeof SheetBotRpcAuthorization.of>[0];

const requireUnexpiredVerifiedToken = ({ exp }: { readonly exp: number | undefined }) =>
  typeof exp === "number"
    ? Clock.currentTimeMillis.pipe(
        Effect.flatMap((now) =>
          now < exp * 1000
            ? Effect.void
            : Effect.fail(
                new SheetBotUnauthorized({ message: "Expired ingress Kubernetes token" }),
              ),
        ),
      )
    : Effect.void;

export const SheetBotRpcAuthorizationLive = Layer.effect(
  SheetBotRpcAuthorization,
  Effect.gen(function* () {
    const podNamespace = yield* config.podNamespace;
    const maybeIngressNamespace = yield* config.sheetIngressNamespace;
    const ingressNamespace = Option.getOrElse(maybeIngressNamespace, () => podNamespace);
    const audience = yield* config.sheetIngressKubernetesAudience;
    const expectedSubject = `system:serviceaccount:${ingressNamespace}:sheet-ingress-server`;

    const ingressTokenCache = yield* Cache.makeWith(
      (token: string) =>
        Effect.tryPromise({
          try: () => verifyKubernetesToken(token, audience),
          catch: (cause) =>
            new SheetBotUnauthorized({
              message: `Invalid ingress Kubernetes token: ${String(cause)}`,
            }),
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
                  new SheetBotUnauthorized({
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

    const middleware: SheetBotRpcAuthorizationMiddleware = Effect.fn("SheetBotRpcAuthorization")(
      function* (rpcEffect, options) {
        const ingressToken = getBearerToken(
          Option.getOrUndefined(Headers.get(options.headers, "x-sheet-ingress-auth")),
        );

        if (!ingressToken) {
          return yield* Effect.fail(
            new SheetBotUnauthorized({ message: "Missing ingress authorization" }),
          );
        }

        const verifiedToken = yield* Cache.get(ingressTokenCache, ingressToken);
        yield* requireUnexpiredVerifiedToken(verifiedToken);

        return yield* rpcEffect;
      },
    );

    return SheetBotRpcAuthorization.of(middleware);
  }),
);
