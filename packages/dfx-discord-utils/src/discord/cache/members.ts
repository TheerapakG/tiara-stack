import { DiscordConfig } from "dfx";
import { Effect, Layer, pipe } from "effect";
import {
  membersApiCacheViewWithReverseLookup,
  membersCacheViewWithReverseLookup,
  membersWithReverseLookup,
  unstorageWithReverseLookupDriver,
} from "@/cache";
import { DiscordApiClient } from "../discordApiClient";
import { DiscordGatewayLayer } from "../gateway";
import { Unstorage } from "./shared";

export class MembersCache extends Effect.Service<MembersCache>()("MembersCache", {
  scoped: pipe(
    Unstorage.prefixed("members:"),
    Effect.andThen((storage) =>
      membersWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
  dependencies: [DiscordGatewayLayer] as const,
}) {}

export const MembersCacheLive: Layer.Layer<
  MembersCache,
  never,
  DiscordConfig.DiscordConfig | Unstorage
> = MembersCache.Default;

export class MembersCacheView extends Effect.Service<MembersCacheView>()("MembersCacheView", {
  scoped: pipe(
    Unstorage.prefixed("members:"),
    Effect.andThen((storage) =>
      membersCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
}) {}

export class MembersApiCacheView extends Effect.Service<MembersApiCacheView>()(
  "MembersApiCacheView",
  {
    scoped: pipe(
      Unstorage.prefixed("members:"),
      Effect.andThen((storage) =>
        membersApiCacheViewWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
      ),
    ),
  },
) {}

export const MembersApiCacheViewLive: Layer.Layer<
  MembersApiCacheView,
  never,
  DiscordApiClient | Unstorage
> = MembersApiCacheView.Default;
