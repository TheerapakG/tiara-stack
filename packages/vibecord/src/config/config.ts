import { loadConfig } from "c12";
import { Effect, pipe, Schema } from "effect";

const configSchema = pipe(
  Schema.Struct({
    DISCORD_TOKEN: Schema.String,
    DISCORD_CLIENT_ID: Schema.String,
  }),
  Schema.rename({
    DISCORD_TOKEN: "discordToken",
    DISCORD_CLIENT_ID: "discordClientId",
  }),
);

export class Config extends Effect.Service<Config>()("Config", {
  effect: pipe(
    Effect.tryPromise(() => loadConfig({ dotenv: true })),
    Effect.andThen(() => Schema.decodeUnknown(configSchema)(process.env)),
  ),
}) {}
