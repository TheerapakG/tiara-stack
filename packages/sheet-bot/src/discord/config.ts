import { Config } from "effect";
import { Intents, makeDiscordConfigLayer } from "dfx-discord-utils/discord";
import { config } from "@/config";

export const DiscordConfigLayer = makeDiscordConfigLayer({
  token: config.discordToken,
  intents: Config.succeed(Intents.fromList(["Guilds", "GuildMembers"])),
});
