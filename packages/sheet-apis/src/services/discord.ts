import { NodeHttpClient } from "@effect/platform-node";
import { apiCacheViewsLayer, Unstorage } from "dfx-discord-utils/discord/cache";
import { DiscordApiClient } from "dfx-discord-utils/discord";
import { Effect, Layer, Redacted } from "effect";
import { config } from "@/config";

const discordApiClientLayer = Layer.unwrap(
  Effect.gen(function* () {
    const cacheApiBaseUrl = yield* config.cacheApiBaseUrl;
    return DiscordApiClient.layer(cacheApiBaseUrl);
  }),
);

const redisLayer = Layer.unwrap(
  Effect.gen(function* () {
    const redisUrl = yield* config.redisUrl;
    return Unstorage.redisLayer({ url: Redacted.value(redisUrl) });
  }),
);

const prefixedUnstorageLayer = Unstorage.prefixedLayer("discord:").pipe(Layer.provide(redisLayer));

export const discordLayer = apiCacheViewsLayer.pipe(
  Layer.provideMerge(discordApiClientLayer),
  Layer.provide([prefixedUnstorageLayer, NodeHttpClient.layerFetch]),
);
