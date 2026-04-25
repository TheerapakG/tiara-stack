import { Config, Schema } from "effect";

export const config = {
  discordToken: Config.schema(Schema.Redacted(Schema.String), "DISCORD_TOKEN"),
  redisUrl: Config.schema(Schema.Redacted(Schema.String), "REDIS_URL"),
  sheetIngressBaseUrl: Config.schema(Schema.String, "SHEET_INGRESS_BASE_URL"),
  sheetAuthIssuer: Config.schema(Schema.String, "SHEET_AUTH_ISSUER"),
};
