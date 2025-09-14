import { loadConfig } from "c12";
import { Effect, pipe, Schema } from "effect";
import { validate } from "typhoon-core/schema";

export class Config extends Effect.Service<Config>()("Config", {
  effect: pipe(
    Effect.tryPromise(() => loadConfig({ dotenv: true })),
    Effect.andThen(
      validate(
        pipe(
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
          Schema.standardSchemaV1,
        ),
      )(process.env),
    ),
  ),
}) {}
