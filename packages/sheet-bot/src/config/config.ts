import { Config, Schema } from "effect";

export const config = {
  discordToken: Config.schema(Schema.Redacted(Schema.String), "DISCORD_TOKEN"),
  redisUrl: Config.schema(Schema.Redacted(Schema.String), "REDIS_URL"),
  sheetApisBaseUrl: Config.schema(Schema.String, "SHEET_APIS_BASE_URL"),
  sheetAuthIssuer: Config.schema(Schema.String, "SHEET_AUTH_ISSUER"),
};
