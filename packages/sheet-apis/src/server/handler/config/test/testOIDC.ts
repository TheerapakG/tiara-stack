import { pipe } from "effect";
import { HandlerConfig } from "typhoon-core/config";
import * as v from "valibot";

export const testOIDCHandlerConfig = pipe(
  HandlerConfig.empty,
  HandlerConfig.Builder.name("testOIDC"),
  HandlerConfig.Builder.type("subscription"),
  HandlerConfig.Builder.requestParams({
    validator: v.object({
      token: v.string(),
    }),
    validate: true,
  }),
  HandlerConfig.Builder.response({
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
  }),
);
