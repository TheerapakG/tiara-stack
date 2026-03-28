import { DiscordConfig } from "dfx";
import { Effect, Layer, pipe } from "effect";
import {
  rolesApiCacheViewWithReverseLookup,
  rolesCacheViewWithReverseLookup,
  rolesWithReverseLookup,
  unstorageWithReverseLookupDriver,
} from "@/cache";
import { DiscordApiClient } from "../discordApiClient";
import { DiscordGatewayLayer } from "../gateway";
import { Unstorage } from "./shared";

export class RolesCache extends Effect.Service<RolesCache>()("RolesCache", {
  scoped: pipe(
    Unstorage.prefixed("roles:"),
    Effect.andThen((storage) =>
      rolesWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
  dependencies: [DiscordGatewayLayer] as const,
}) {}

export const RolesCacheLive: Layer.Layer<
  RolesCache,
  never,
  DiscordConfig.DiscordConfig | Unstorage
> = RolesCache.Default;

export class RolesCacheView extends Effect.Service<RolesCacheView>()("RolesCacheView", {
  scoped: pipe(
    Unstorage.prefixed("roles:"),
    Effect.andThen((storage) =>
      rolesCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
}) {}

export class RolesApiCacheView extends Effect.Service<RolesApiCacheView>()("RolesApiCacheView", {
  scoped: pipe(
    Unstorage.prefixed("roles:"),
    Effect.andThen((storage) =>
      rolesApiCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
}) {}

export const RolesApiCacheViewLive: Layer.Layer<
  RolesApiCacheView,
  never,
  DiscordApiClient | Unstorage
> = RolesApiCacheView.Default;
