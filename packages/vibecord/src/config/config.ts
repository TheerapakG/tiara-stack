import { loadConfig } from "c12";
import { Context, Effect, Layer, pipe, Schema } from "effect";

const configSchema = pipe(
  Schema.Struct({
    discordToken: Schema.String,
    discordClientId: Schema.String,
  }),
  Schema.encodeKeys({
    discordToken: "DISCORD_TOKEN",
    discordClientId: "DISCORD_CLIENT_ID",
  }),
);

const configEffect = pipe(
  Effect.tryPromise(() => loadConfig({ dotenv: true })),
  Effect.andThen(() => Schema.decodeUnknownEffect(configSchema)(process.env)),
);

export class Config extends Context.Service<Config>()("Config", {
  make: configEffect,
}) {
  static Default = Layer.effect(Config, Config.make);
}
