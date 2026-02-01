import { FileSystem } from "@effect/platform";
import { Effect, Layer, pipe, Redacted } from "effect";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { KubernetesTokenAuthorization, Unauthorized } from "./tag";

export const KubernetesTokenAuthorizationLive = Layer.effect(
  KubernetesTokenAuthorization,
  pipe(
    Effect.Do,
    Effect.bind("fs", () => FileSystem.FileSystem),
    Effect.bind("kubernetesToken", ({ fs }) =>
      fs.readFileString("/var/run/secrets/kubernetes.io/serviceaccount/token", "utf-8"),
    ),
    Effect.bind("jwks", ({ kubernetesToken }) =>
      pipe(
        Effect.try(() =>
          createRemoteJWKSet(
            new URL("https://kubernetes.default.svc.cluster.local/openid/v1/jwks"),
            { headers: { Authorization: `Bearer ${kubernetesToken}` } },
          ),
        ),
      ),
    ),
    Effect.map(({ jwks }) =>
      KubernetesTokenAuthorization.of({
        kubernetesToken: (token) =>
          pipe(
            Effect.tryPromise({
              try: () =>
                jwtVerify(Redacted.value(token), jwks, {
                  issuer: "https://kubernetes.default.svc.cluster.local",
                  audience: "sheet-apis",
                }),
              catch: (cause) =>
                new Unauthorized({
                  message: "Error verifying Kubernetes sheet-apis service account token",
                  cause,
                }),
            }),
            Effect.withSpan("KubernetesTokenAuthorization.kubernetesToken", {
              captureStackTrace: true,
            }),
          ),
      }),
    ),
  ),
);
