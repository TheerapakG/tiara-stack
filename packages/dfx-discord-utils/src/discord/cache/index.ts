import { Discord, DiscordConfig } from "dfx";
import { Layer } from "effect";
import { HttpClientError } from "effect/unstable/http";
import { ChannelsApiCacheView, ChannelsCache } from "./channels";
import { GuildsApiCacheView, GuildsCache } from "./guilds";
import { MembersApiCacheView, MembersCache } from "./members";
import { RolesApiCacheView, RolesCache } from "./roles";
import { Unstorage } from "./shared";
import { DiscordApiClient } from "../discordApiClient";

export * from "./shared";
export * from "./guilds";
export * from "./roles";
export * from "./members";
export * from "./channels";

export const cachesLayer: Layer.Layer<
  GuildsCache | RolesCache | MembersCache | ChannelsCache,
  | Discord.DiscordRestError<"ErrorResponse", Discord.ErrorResponse>
  | Discord.DiscordRestError<"RatelimitedResponse", Discord.RatelimitedResponse>
  | HttpClientError.HttpClientError,
  DiscordConfig.DiscordConfig | Unstorage
> = Layer.mergeAll(GuildsCache.layer, RolesCache.layer, MembersCache.layer, ChannelsCache.layer);

export const apiCacheViewsLayer: Layer.Layer<
  GuildsApiCacheView | RolesApiCacheView | MembersApiCacheView | ChannelsApiCacheView,
  never,
  DiscordApiClient | Unstorage
> = Layer.mergeAll(
  GuildsApiCacheView.layer,
  RolesApiCacheView.layer,
  MembersApiCacheView.layer,
  ChannelsApiCacheView.layer,
);
