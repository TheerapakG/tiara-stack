import { DiscordConfig } from "dfx";
import { Layer } from "effect";
import { DiscordApiClient } from "../discordApiClient";
import {
  ChannelsApiCacheView,
  ChannelsApiCacheViewLive,
  ChannelsCache,
  ChannelsCacheLive,
} from "./channels";
import { GuildsApiCacheView, GuildsApiCacheViewLive, GuildsCache, GuildsCacheLive } from "./guilds";
import {
  MembersApiCacheView,
  MembersApiCacheViewLive,
  MembersCache,
  MembersCacheLive,
} from "./members";
import { RolesApiCacheView, RolesApiCacheViewLive, RolesCache, RolesCacheLive } from "./roles";

export * from "./shared";
export * from "./guilds";
export * from "./roles";
export * from "./members";
export * from "./channels";

export const CachesLive: Layer.Layer<
  GuildsCache | RolesCache | MembersCache | ChannelsCache,
  never,
  DiscordConfig.DiscordConfig | import("./shared").Unstorage
> = Layer.mergeAll(GuildsCacheLive, RolesCacheLive, MembersCacheLive, ChannelsCacheLive);

export const ApiCacheViewsLive: Layer.Layer<
  GuildsApiCacheView | RolesApiCacheView | MembersApiCacheView | ChannelsApiCacheView,
  never,
  DiscordApiClient | import("./shared").Unstorage
> = Layer.mergeAll(
  GuildsApiCacheViewLive,
  RolesApiCacheViewLive,
  MembersApiCacheViewLive,
  ChannelsApiCacheViewLive,
);
