import { Effect, pipe } from "effect";
import fs from "fs/promises";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { computed } from "typhoon-core/signal";
import { defineHandlerConfigBuilder } from "typhoon-server/config";
import { defineHandlerBuilder, Event } from "typhoon-server/server";
import * as v from "valibot";

const testOIDCHandlerConfig = defineHandlerConfigBuilder()
  .name("testOIDC")
  .type("subscription")
  .request({
    validator: v.object({
      token: v.string(),
    }),
    validate: true,
  })
  .response({
    validator: v.object({
      payload: v.object({
        iss: v.optional(v.string()),
        sub: v.optional(v.string()),
        aud: v.optional(v.union([v.string(), v.array(v.string())])),
        jti: v.optional(v.string()),
        nbf: v.optional(v.number()),
        exp: v.optional(v.number()),
        iat: v.optional(v.number()),
      }),
    }),
  })
  .build();

export const testOIDCHandler = defineHandlerBuilder()
  .config(testOIDCHandlerConfig)
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("parsed", () =>
        Event.withConfig(testOIDCHandlerConfig).request.parsed(),
      ),
      Effect.flatMap(({ parsed }) =>
        pipe(
          computed(
            pipe(
              Effect.Do,
              Effect.bind("parsed", () => parsed),
              Effect.let("token", ({ parsed }) => parsed.token),
              Effect.bind("kubernetesToken", () =>
                Effect.tryPromise(() =>
                  fs.readFile(
                    "/var/run/secrets/kubernetes.io/serviceaccount/token",
                    "utf-8",
                  ),
                ),
              ),
              Effect.bind("jwks", ({ kubernetesToken }) =>
                pipe(
                  Effect.try(() =>
                    createRemoteJWKSet(
                      new URL(
                        "https://kubernetes.default.svc.cluster.local/openid/v1/jwks",
                      ),
                      {
                        headers: {
                          Authorization: `Bearer ${kubernetesToken}`,
                        },
                      },
                    ),
                  ),
                  Effect.withSpan("createRemoteJWKSet", {
                    captureStackTrace: true,
                  }),
                ),
              ),
              Effect.bind("result", ({ jwks, token }) =>
                pipe(
                  Effect.tryPromise(() =>
                    jwtVerify(token, jwks, {
                      issuer: "https://kubernetes.default.svc.cluster.local",
                      audience: "sheet-apis",
                    }),
                  ),
                  Effect.withSpan("jwtVerify", { captureStackTrace: true }),
                ),
              ),
              Effect.map(({ result }) => ({
                payload: result.payload,
              })),
            ),
          ),
        ),
      ),
      Effect.withSpan("testOIDCHandler", { captureStackTrace: true }),
    ),
  );
