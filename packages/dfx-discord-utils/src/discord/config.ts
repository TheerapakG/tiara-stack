import { DiscordConfig, Intents } from "dfx";
import { Config, ConfigError, Layer, Redacted } from "effect";

export interface DiscordConfigOptions {
  token: Config.Config<Redacted.Redacted<string>>;
  intents?: Config.Config<number>;
}

export const makeDiscordConfigLayer = (
  options: DiscordConfigOptions,
): Layer.Layer<DiscordConfig.DiscordConfig, ConfigError.ConfigError, never> =>
  DiscordConfig.layerConfig({
    token: options.token,
    gateway: {
      intents: options.intents ?? Config.succeed(Intents.fromList(["Guilds", "GuildMembers"])),
    },
  });

export { Intents } from "dfx";
