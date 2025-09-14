import { defineHandlerConfigBuilder } from "typhoon-server/config";
import * as v from "valibot";

export const testOIDCHandlerConfig = defineHandlerConfigBuilder()
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
