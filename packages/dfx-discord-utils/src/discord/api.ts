import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import {
  ApplicationValueSchema,
  GuildValueSchema,
  ChannelValueSchema,
  RoleValueSchema,
  MemberValueSchema,
  ChannelCacheEntriesSchema,
  RoleCacheEntriesSchema,
  MemberCacheEntriesSchema,
  CacheSizeSchema,
  CacheNotFoundError,
} from "./schema";

// Path parameters
export const ParentIdParam = Schema.String;
export const ResourceIdParam = Schema.String;

// Route ordering note: @effect/platform's HTTP router prioritizes static segments over
// parameterised ones (e.g., `/cache/guilds/size` matches before `/cache/guilds/:resourceId`).
// This ensures `/resource/*` and `/size` endpoints remain reachable despite appearing after
// dynamic routes in the registration order.

export class ApplicationApi extends HttpApiGroup.make("application")
  .add(HttpApiEndpoint.get("getApplication", "/application").addSuccess(ApplicationValueSchema))
  .annotate(OpenApi.Title, "Application")
  .annotate(OpenApi.Description, "Discord application metadata API") {}

// Cache API Group
export class CacheApi extends HttpApiGroup.make("cache")
  // Guild cache endpoints (simple cache - only resourceId needed)
  .add(
    HttpApiEndpoint.get("getGuild", "/cache/guilds/:resourceId")
      .setPath(Schema.Struct({ resourceId: ResourceIdParam }))
      .addSuccess(GuildValueSchema)
      .addError(CacheNotFoundError),
  )
  .add(HttpApiEndpoint.get("getGuildSize", "/cache/guilds/size").addSuccess(CacheSizeSchema))
  // Reverse lookup cache endpoints - get specific resource
  .add(
    HttpApiEndpoint.get("getChannel", "/cache/channels/:parentId/:resourceId")
      .setPath(Schema.Struct({ parentId: ParentIdParam, resourceId: ResourceIdParam }))
      .addSuccess(ChannelValueSchema)
      .addError(CacheNotFoundError),
  )
  .add(
    HttpApiEndpoint.get("getRole", "/cache/roles/:parentId/:resourceId")
      .setPath(Schema.Struct({ parentId: ParentIdParam, resourceId: ResourceIdParam }))
      .addSuccess(RoleValueSchema)
      .addError(CacheNotFoundError),
  )
  .add(
    HttpApiEndpoint.get("getMember", "/cache/members/:parentId/:resourceId")
      .setPath(Schema.Struct({ parentId: ParentIdParam, resourceId: ResourceIdParam }))
      .addSuccess(MemberValueSchema)
      .addError(CacheNotFoundError),
  )
  // Reverse lookup cache endpoints - get all for parent
  .add(
    HttpApiEndpoint.get("getChannelsForParent", "/cache/channels/:parentId")
      .setPath(Schema.Struct({ parentId: ParentIdParam }))
      .addSuccess(ChannelCacheEntriesSchema)
      .addError(CacheNotFoundError),
  )
  .add(
    HttpApiEndpoint.get("getRolesForParent", "/cache/roles/:parentId")
      .setPath(Schema.Struct({ parentId: ParentIdParam }))
      .addSuccess(RoleCacheEntriesSchema)
      .addError(CacheNotFoundError),
  )
  .add(
    HttpApiEndpoint.get("getMembersForParent", "/cache/members/:parentId")
      .setPath(Schema.Struct({ parentId: ParentIdParam }))
      .addSuccess(MemberCacheEntriesSchema)
      .addError(CacheNotFoundError),
  )
  // Reverse lookup cache endpoints - get all for resource (cross-parent lookup)
  .add(
    HttpApiEndpoint.get("getChannelsForResource", "/cache/channels/resource/:resourceId")
      .setPath(Schema.Struct({ resourceId: ResourceIdParam }))
      .addSuccess(ChannelCacheEntriesSchema)
      .addError(CacheNotFoundError),
  )
  .add(
    HttpApiEndpoint.get("getRolesForResource", "/cache/roles/resource/:resourceId")
      .setPath(Schema.Struct({ resourceId: ResourceIdParam }))
      .addSuccess(RoleCacheEntriesSchema)
      .addError(CacheNotFoundError),
  )
  .add(
    HttpApiEndpoint.get("getMembersForResource", "/cache/members/resource/:resourceId")
      .setPath(Schema.Struct({ resourceId: ResourceIdParam }))
      .addSuccess(MemberCacheEntriesSchema)
      .addError(CacheNotFoundError),
  )
  // Size endpoints for reverse lookup caches
  .add(HttpApiEndpoint.get("getChannelsSize", "/cache/channels/size").addSuccess(CacheSizeSchema))
  .add(HttpApiEndpoint.get("getRolesSize", "/cache/roles/size").addSuccess(CacheSizeSchema))
  .add(HttpApiEndpoint.get("getMembersSize", "/cache/members/size").addSuccess(CacheSizeSchema))
  .add(
    HttpApiEndpoint.get("getChannelsSizeForParent", "/cache/channels/:parentId/size")
      .setPath(Schema.Struct({ parentId: ParentIdParam }))
      .addSuccess(CacheSizeSchema),
  )
  .add(
    HttpApiEndpoint.get("getRolesSizeForParent", "/cache/roles/:parentId/size")
      .setPath(Schema.Struct({ parentId: ParentIdParam }))
      .addSuccess(CacheSizeSchema),
  )
  .add(
    HttpApiEndpoint.get("getMembersSizeForParent", "/cache/members/:parentId/size")
      .setPath(Schema.Struct({ parentId: ParentIdParam }))
      .addSuccess(CacheSizeSchema),
  )
  .add(
    HttpApiEndpoint.get("getChannelsSizeForResource", "/cache/channels/resource/:resourceId/size")
      .setPath(Schema.Struct({ resourceId: ResourceIdParam }))
      .addSuccess(CacheSizeSchema),
  )
  .add(
    HttpApiEndpoint.get("getRolesSizeForResource", "/cache/roles/resource/:resourceId/size")
      .setPath(Schema.Struct({ resourceId: ResourceIdParam }))
      .addSuccess(CacheSizeSchema),
  )
  .add(
    HttpApiEndpoint.get("getMembersSizeForResource", "/cache/members/resource/:resourceId/size")
      .setPath(Schema.Struct({ resourceId: ResourceIdParam }))
      .addSuccess(CacheSizeSchema),
  )
  .annotate(OpenApi.Title, "Cache")
  .annotate(OpenApi.Description, "Discord cache lookup API") {}

export class DiscordApi extends HttpApi.make("discord")
  .add(ApplicationApi)
  .add(CacheApi)
  .annotate(OpenApi.Title, "Discord API")
  .annotate(OpenApi.Description, "HTTP API for Discord application metadata and cache lookups") {}
