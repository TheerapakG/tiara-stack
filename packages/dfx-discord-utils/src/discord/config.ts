import { DiscordConfig, Intents } from "dfx";
import { Config, Redacted } from "effect";

export interface DiscordConfigOptions {
  token: Config.Config<Redacted.Redacted<string>>;
  intents?: Config.Config<number>;
}

export const makeDiscordConfigLayer = (options: DiscordConfigOptions) =>
  DiscordConfig.layerConfig({
    token: options.token,
    gateway: {
      intents: options.intents ?? Config.succeed(Intents.fromList(["Guilds", "GuildMembers"])),
    },
  });

export { Intents } from "dfx";
