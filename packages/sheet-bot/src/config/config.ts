import { loadConfig } from "c12";
import { Effect, pipe, Schema } from "effect";

const configSchema = pipe(
  Schema.Struct({
    POSTGRES_URL: Schema.String,
    DISCORD_TOKEN: Schema.String,
    SHEET_APIS_BASE_URL: Schema.String,
  }),
  Schema.rename({
    POSTGRES_URL: "postgresUrl",
    DISCORD_TOKEN: "discordToken",
    SHEET_APIS_BASE_URL: "sheetApisBaseUrl",
  }),
);

export class Config extends Effect.Service<Config>()("Config", {
  effect: pipe(
    Effect.tryPromise(() => loadConfig({ dotenv: true })),
    Effect.andThen(Schema.decodeUnknown(configSchema)(process.env)),
  ),
}) {}
