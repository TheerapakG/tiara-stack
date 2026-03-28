import { ApiCacheViewsLive } from "dfx-discord-utils/discord/cache";
import { DiscordApiClient } from "dfx-discord-utils/discord";
import { Effect, Layer } from "effect";
import { config } from "@/config";

export const DiscordApiClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const cacheApiBaseUrl = yield* config.cacheApiBaseUrl;
    return DiscordApiClient.Live(cacheApiBaseUrl);
  }),
);

export const CachesLive = ApiCacheViewsLive.pipe(Layer.provide(DiscordApiClientLive));
