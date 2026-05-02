import { DiscordApplication } from "dfx-discord-utils/discord";
import { Layer } from "effect";
import { discordConfigLayer } from "./config";

export const discordApplicationLayer = DiscordApplication.layer.pipe(
  Layer.provide(discordConfigLayer),
);
