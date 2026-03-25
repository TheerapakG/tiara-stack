import {
  GuildsApiCacheView,
  RolesApiCacheView,
  MembersApiCacheView,
  ChannelsApiCacheView,
  DiscordApiClient,
} from "dfx-discord-utils/discord";
import { Effect, Layer } from "effect";
import { config } from "@/config";

export const DiscordApiClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const cacheApiBaseUrl = yield* config.cacheApiBaseUrl;
    return DiscordApiClient.Live(cacheApiBaseUrl);
  }),
);

export const CacheLive = Layer.mergeAll(
  GuildsApiCacheView.Default,
  RolesApiCacheView.Default,
  MembersApiCacheView.Default,
  ChannelsApiCacheView.Default,
).pipe(Layer.provide(DiscordApiClientLive));
