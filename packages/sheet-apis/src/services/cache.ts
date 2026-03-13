import {
  GuildsApiCacheView,
  RolesApiCacheView,
  MembersApiCacheView,
  ChannelsApiCacheView,
  CacheApiClient,
} from "dfx-discord-utils/discord";
import { Effect, Layer } from "effect";
import { config } from "@/config";

const CacheApiClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const cacheApiBaseUrl = yield* config.cacheApiBaseUrl;
    return CacheApiClient.Live(cacheApiBaseUrl);
  }),
);

export const CacheLive = Layer.mergeAll(
  GuildsApiCacheView.Default,
  RolesApiCacheView.Default,
  MembersApiCacheView.Default,
  ChannelsApiCacheView.Default,
).pipe(Layer.provide(CacheApiClientLive));
