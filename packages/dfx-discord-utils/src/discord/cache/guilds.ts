import { DiscordConfig } from "dfx";
import { CachePrelude } from "dfx/gateway";
import { Effect, Layer, pipe } from "effect";
import { guildsCacheView, guildsApiCacheView, unstorageDriver } from "@/cache";
import { DiscordApiClient } from "../discordApiClient";
import { DiscordGatewayLayer } from "../gateway";
import { Unstorage } from "./shared";

export class GuildsCache extends Effect.Service<GuildsCache>()("GuildsCache", {
  scoped: pipe(
    Unstorage.prefixed("guilds:"),
    Effect.andThen((storage) => CachePrelude.guilds(unstorageDriver({ storage }))),
  ),
  dependencies: [DiscordGatewayLayer] as const,
}) {}

export const GuildsCacheLive: Layer.Layer<
  GuildsCache,
  never,
  DiscordConfig.DiscordConfig | Unstorage
> = GuildsCache.Default;

export class GuildsCacheView extends Effect.Service<GuildsCacheView>()("GuildsCacheView", {
  scoped: pipe(
    Unstorage.prefixed("guilds:"),
    Effect.andThen((storage) => guildsCacheView(unstorageDriver({ storage }))),
  ),
}) {}

export class GuildsApiCacheView extends Effect.Service<GuildsApiCacheView>()("GuildsApiCacheView", {
  scoped: pipe(
    Unstorage.prefixed("guilds:"),
    Effect.andThen((storage) => guildsApiCacheView(unstorageDriver({ storage }))),
  ),
}) {}

export const GuildsApiCacheViewLive: Layer.Layer<
  GuildsApiCacheView,
  never,
  DiscordApiClient | Unstorage
> = GuildsApiCacheView.Default;
