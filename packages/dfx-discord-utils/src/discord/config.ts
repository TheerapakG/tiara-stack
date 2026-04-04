import { DiscordConfig, Intents } from "dfx";
import { Config, Effect, Layer, Redacted } from "effect";

export interface DiscordConfigOptions {
  token: Config.Config<Redacted.Redacted<string>>;
  intents?: Config.Config<number>;
}

export const discordConfigLayer = (options: DiscordConfigOptions) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const intents = options.intents ? yield* options.intents : 0;
      return DiscordConfig.layerConfig({
        token: options.token,
        gateway: {
          intents: Config.succeed(
            Intents.fromList([...Intents.toList(intents), "Guilds", "GuildMembers"]),
          ),
        },
      });
    }),
  );
