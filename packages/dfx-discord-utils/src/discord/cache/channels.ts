import { DiscordConfig } from "dfx";
import { Effect, Layer, pipe } from "effect";
import {
  channelsApiCacheViewWithReverseLookup,
  channelsCacheViewWithReverseLookup,
  channelsWithReverseLookup,
  unstorageWithReverseLookupDriver,
} from "@/cache";
import { DiscordApiClient } from "../discordApiClient";
import { DiscordGatewayLayer } from "../gateway";
import { Unstorage } from "./shared";

export class ChannelsCache extends Effect.Service<ChannelsCache>()("ChannelsCache", {
  scoped: pipe(
    Unstorage.prefixed("channels:"),
    Effect.andThen((storage) =>
      channelsWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
  dependencies: [DiscordGatewayLayer] as const,
}) {}

export const ChannelsCacheLive: Layer.Layer<
  ChannelsCache,
  never,
  DiscordConfig.DiscordConfig | Unstorage
> = ChannelsCache.Default;

export class ChannelsCacheView extends Effect.Service<ChannelsCacheView>()("ChannelsCacheView", {
  scoped: pipe(
    Unstorage.prefixed("channels:"),
    Effect.andThen((storage) =>
      channelsCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
}) {}

export class ChannelsApiCacheView extends Effect.Service<ChannelsApiCacheView>()(
  "ChannelsApiCacheView",
  {
    scoped: pipe(
      Unstorage.prefixed("channels:"),
      Effect.andThen((storage) =>
        channelsApiCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
      ),
    ),
  },
) {}

export const ChannelsApiCacheViewLive: Layer.Layer<
  ChannelsApiCacheView,
  never,
  DiscordApiClient | Unstorage
> = ChannelsApiCacheView.Default;
