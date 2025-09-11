import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect, pipe } from "effect";
import { createRemoteJWKSet, jwtVerify } from "jose";

export class AuthService extends Effect.Service<AuthService>()("AuthService", {
  effect: pipe(
    Effect.Do,
    Effect.bind("fs", () => FileSystem.FileSystem),
    Effect.bind("kubernetesToken", ({ fs }) =>
      fs.readFileString(
        "/var/run/secrets/kubernetes.io/serviceaccount/token",
        "utf-8",
      ),
    ),
    Effect.bind("jwks", ({ kubernetesToken }) =>
      pipe(
        Effect.try(() =>
          createRemoteJWKSet(
            new URL(
              "https://kubernetes.default.svc.cluster.local/openid/v1/jwks",
            ),
            { headers: { Authorization: `Bearer ${kubernetesToken}` } },
          ),
        ),
      ),
    ),
    Effect.map(({ jwks }) => ({
      verify: (token: string) =>
        pipe(
          Effect.tryPromise(() =>
            jwtVerify(token, jwks, {
              issuer: "https://kubernetes.default.svc.cluster.local",
              audience: "sheet-apis",
            }),
          ),
          Effect.withSpan("AuthService.verify", { captureStackTrace: true }),
        ),
    })),
  ),
  accessors: true,
  dependencies: [NodeContext.layer],
}) {}
