import { Config, Schema, SchemaGetter } from "effect";

const split = (separator: string) =>
  Schema.String.pipe(
    Schema.decodeTo(Schema.Array(Schema.String), {
      decode: SchemaGetter.split({ separator }),
      encode: SchemaGetter.transform((arr: ReadonlyArray<string>) => arr.join(separator)),
    }),
  );

export const config = {
  zeroCacheServer: Config.schema(Schema.String, "ZERO_CACHE_SERVER"),
  zeroCacheUserId: Config.schema(Schema.String, "ZERO_CACHE_USER_ID"),
  sheetAuthIssuer: Config.schema(Schema.String, "SHEET_AUTH_ISSUER"),
  trustedOrigins: Config.schema(
    split(",").pipe(
      Schema.decodeTo(Schema.Array(Schema.Trim), {
        decode: SchemaGetter.passthrough(),
        encode: SchemaGetter.passthrough(),
      }),
    ),
    "TRUSTED_ORIGINS",
  ),
  redisUrl: Config.schema(Schema.Redacted(Schema.String), "REDIS_URL"),
  sheetIngressBaseUrl: Config.schema(Schema.String, "SHEET_INGRESS_BASE_URL"),
};
