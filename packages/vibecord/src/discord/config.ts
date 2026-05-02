import { Config } from "../config/config";
import { Config as EffectConfig, Layer, Redacted } from "effect";
import { Intents } from "dfx";
import { discordConfigLayer as baseDiscordConfigLayer } from "dfx-discord-utils/discord";

export const discordConfigLayer = Layer.unwrap(
  Config.useSync((config) =>
    baseDiscordConfigLayer({
      token: EffectConfig.succeed(Redacted.make(config.discordToken)),
      intents: EffectConfig.succeed(Intents.fromList(["Guilds"])),
    }),
  ),
).pipe(Layer.provide(Config.Default));
