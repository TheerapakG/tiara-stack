import { Config } from "effect";
import { Intents } from "dfx";
import { discordConfigLayer as baseDiscordConfigLayer } from "dfx-discord-utils/discord";
import { config } from "@/config";

export const discordConfigLayer = baseDiscordConfigLayer({
  token: config.discordToken,
  intents: Config.succeed(Intents.fromList(["Guilds", "GuildMembers"])),
});
