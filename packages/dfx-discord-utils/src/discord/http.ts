import { HttpApiBuilder, HttpApiGroup } from "effect/unstable/httpapi";
import { HttpClientError } from "effect/unstable/http";
import { Effect, Layer, Predicate } from "effect";
import { DiscordApi } from "./api";
import { GuildsCache, ChannelsCache, RolesCache, MembersCache } from "./cache";
import { DiscordApplication } from "./gateway";
import { CacheNotFoundError } from "./schema";
import { Discord, DiscordConfig } from "dfx";

// Helper to convert a ReadonlyMap to CacheEntries array
const mapToEntries = <A>(map: ReadonlyMap<string, A>, parentId: string) =>
  Array.from(map.entries()).map(([resourceId, value]) => ({
    parentId,
    resourceId,
    value,
  }));

// Helper to convert a ReadonlyMap to CacheEntries array for resource lookup (cross-parent)
const resourceMapToEntries = <A>(map: ReadonlyMap<string, A>, resourceId: string) =>
  Array.from(map.entries()).map(([parentId, value]) => ({
    parentId,
    resourceId,
    value,
  }));

// Helper to check if error is CacheMissError
const isCacheMissError = Predicate.isTagged("CacheMissError");

// Helper to handle cache errors - converts CacheMissError to CacheNotFoundError, re-throws others as defects
const handleCacheError = <A>(
  effect: Effect.Effect<A, unknown, never>,
  notFoundMessage: string,
): Effect.Effect<A, CacheNotFoundError, never> =>
  effect.pipe(
    Effect.catch((err) => {
      if (isCacheMissError(err)) {
        return Effect.fail(new CacheNotFoundError({ message: notFoundMessage }));
      }
      // Re-throw infrastructure errors as defects (will result in HTTP 500)
      return Effect.die(err);
    }),
  );

// Helper to handle size endpoint errors - logs error message and re-throws for 500 response
const handleSizeError = <A>(
  effect: Effect.Effect<A, unknown, never>,
  errorMessage: string,
): Effect.Effect<A, never, never> =>
  effect.pipe(
    Effect.tapError((err) => Effect.logError(`${errorMessage}: ${String(err)}`)),
    Effect.orDie,
  );

export const applicationLayer = HttpApiBuilder.group(
  DiscordApi,
  "application",
  Effect.fnUntraced(function* (handlers) {
    const application = yield* DiscordApplication;

    return handlers.handle("getApplication", () =>
      Effect.succeed({ ownerId: application.owner.id }),
    );
  }),
).pipe(Layer.provide(DiscordApplication.layer));

export const cacheApiLayer = HttpApiBuilder.group(
  DiscordApi,
  "cache",
  Effect.fnUntraced(function* (handlers) {
    const guildsCache = yield* GuildsCache;
    const channelsCache = yield* ChannelsCache;
    const rolesCache = yield* RolesCache;
    const membersCache = yield* MembersCache;

    return (
      handlers
        // Guild cache endpoints
        .handle("getGuild", ({ params: { resourceId } }) =>
          handleCacheError(
            guildsCache.get(resourceId).pipe(Effect.map((value) => ({ value }))),
            `Guild ${resourceId} not found`,
          ),
        )
        .handle("getGuildSize", () =>
          handleSizeError(
            guildsCache.size.pipe(Effect.map((size) => ({ size }))),
            "Failed to get guild size",
          ),
        )
        // Channel cache endpoints - get specific resource
        .handle("getChannel", ({ params: { parentId, resourceId } }) =>
          handleCacheError(
            channelsCache.get(parentId, resourceId).pipe(Effect.map((value) => ({ value }))),
            `Channel ${resourceId} in guild ${parentId} not found`,
          ),
        )
        // Role cache endpoints - get specific resource
        .handle("getRole", ({ params: { parentId, resourceId } }) =>
          handleCacheError(
            rolesCache.get(parentId, resourceId).pipe(Effect.map((value) => ({ value }))),
            `Role ${resourceId} in guild ${parentId} not found`,
          ),
        )
        // Member cache endpoints - get specific resource
        .handle("getMember", ({ params: { parentId, resourceId } }) =>
          handleCacheError(
            membersCache.get(parentId, resourceId).pipe(Effect.map((value) => ({ value }))),
            `Member ${resourceId} in guild ${parentId} not found`,
          ),
        )
        // Channel cache endpoints - get all for parent
        .handle("getChannelsForParent", ({ params: { parentId } }) =>
          handleCacheError(
            channelsCache
              .getForParent(parentId)
              .pipe(Effect.map((map) => mapToEntries(map, parentId))),
            `No channels found for guild ${parentId}`,
          ),
        )
        // Role cache endpoints - get all for parent
        .handle("getRolesForParent", ({ params: { parentId } }) =>
          handleCacheError(
            rolesCache
              .getForParent(parentId)
              .pipe(Effect.map((map) => mapToEntries(map, parentId))),
            `No roles found for guild ${parentId}`,
          ),
        )
        // Member cache endpoints - get all for parent
        .handle("getMembersForParent", ({ params: { parentId } }) =>
          handleCacheError(
            membersCache
              .getForParent(parentId)
              .pipe(Effect.map((map) => mapToEntries(map, parentId))),
            `No members found for guild ${parentId}`,
          ),
        )
        // Channel cache endpoints - get all for resource (cross-parent lookup)
        .handle("getChannelsForResource", ({ params: { resourceId } }) =>
          handleCacheError(
            channelsCache
              .getForResource(resourceId)
              .pipe(Effect.map((map) => resourceMapToEntries(map, resourceId))),
            `Channel ${resourceId} not found in any guild`,
          ),
        )
        // Role cache endpoints - get all for resource (cross-parent lookup)
        .handle("getRolesForResource", ({ params: { resourceId } }) =>
          handleCacheError(
            rolesCache
              .getForResource(resourceId)
              .pipe(Effect.map((map) => resourceMapToEntries(map, resourceId))),
            `Role ${resourceId} not found in any guild`,
          ),
        )
        // Member cache endpoints - get all for resource (cross-parent lookup)
        .handle("getMembersForResource", ({ params: { resourceId } }) =>
          handleCacheError(
            membersCache
              .getForResource(resourceId)
              .pipe(Effect.map((map) => resourceMapToEntries(map, resourceId))),
            `Member ${resourceId} not found in any guild`,
          ),
        )
        // Size endpoints
        .handle("getChannelsSize", () =>
          handleSizeError(
            channelsCache.size.pipe(Effect.map((size) => ({ size }))),
            "Failed to get channels size",
          ),
        )
        .handle("getRolesSize", () =>
          handleSizeError(
            rolesCache.size.pipe(Effect.map((size) => ({ size }))),
            "Failed to get roles size",
          ),
        )
        .handle("getMembersSize", () =>
          handleSizeError(
            membersCache.size.pipe(Effect.map((size) => ({ size }))),
            "Failed to get members size",
          ),
        )
        .handle("getChannelsSizeForParent", ({ params: { parentId } }) =>
          handleSizeError(
            channelsCache.sizeForParent(parentId).pipe(Effect.map((size) => ({ size }))),
            "Failed to get channels size for guild ${parentId}",
          ),
        )
        .handle("getRolesSizeForParent", ({ params: { parentId } }) =>
          handleSizeError(
            rolesCache.sizeForParent(parentId).pipe(Effect.map((size) => ({ size }))),
            "Failed to get roles size for guild ${parentId}",
          ),
        )
        .handle("getMembersSizeForParent", ({ params: { parentId } }) =>
          handleSizeError(
            membersCache.sizeForParent(parentId).pipe(Effect.map((size) => ({ size }))),
            "Failed to get members size for guild ${parentId}",
          ),
        )
        .handle("getChannelsSizeForResource", ({ params: { resourceId } }) =>
          handleSizeError(
            channelsCache.sizeForResource(resourceId).pipe(Effect.map((size) => ({ size }))),
            "Failed to get channels size for resource ${resourceId}",
          ),
        )
        .handle("getRolesSizeForResource", ({ params: { resourceId } }) =>
          handleSizeError(
            rolesCache.sizeForResource(resourceId).pipe(Effect.map((size) => ({ size }))),
            `Failed to get roles size for resource ${resourceId}`,
          ),
        )
        .handle("getMembersSizeForResource", ({ params: { resourceId } }) =>
          handleSizeError(
            membersCache.sizeForResource(resourceId).pipe(Effect.map((size) => ({ size }))),
            `Failed to get members size for resource ${resourceId}`,
          ),
        )
    );
  }),
);

export const discordApiLayer: Layer.Layer<
  HttpApiGroup.ApiGroup<"discord", "application"> | HttpApiGroup.ApiGroup<"discord", "cache">,
  | Discord.DiscordRestError<"RatelimitedResponse", Discord.RatelimitedResponse>
  | Discord.DiscordRestError<"ErrorResponse", Discord.ErrorResponse>
  | HttpClientError.HttpClientError,
  DiscordConfig.DiscordConfig | ChannelsCache | GuildsCache | MembersCache | RolesCache
> = Layer.merge(applicationLayer, cacheApiLayer);
