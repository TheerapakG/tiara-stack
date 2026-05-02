import { Layer } from "effect";
import { discordGatewayLayer as baseDiscordGatewayLayer } from "dfx-discord-utils/discord";
import { discordConfigLayer } from "./config";

export const discordGatewayLayer = baseDiscordGatewayLayer.pipe(Layer.provide(discordConfigLayer));
