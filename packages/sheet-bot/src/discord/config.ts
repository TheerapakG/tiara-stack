import { DiscordConfig, Intents } from "dfx";
import { Config } from "effect";
import { config } from "@/config";

export const DiscordConfigLayer = DiscordConfig.layerConfig({
  token: config.discordToken,
  gateway: {
    intents: Config.succeed(Intents.fromList(["Guilds", "GuildMembers"])),
  },
});
