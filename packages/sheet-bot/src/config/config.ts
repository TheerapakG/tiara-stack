import { Schema } from "effect";

export const config = {
  discordToken: Schema.Config("DISCORD_TOKEN", Schema.Redacted(Schema.String)),
  redisUrl: Schema.Config("REDIS_URL", Schema.Redacted(Schema.String)),
  sheetApisBaseUrl: Schema.Config("SHEET_APIS_BASE_URL", Schema.String),
};
