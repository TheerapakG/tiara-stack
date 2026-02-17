import { CachePrelude } from "dfx/gateway";
import { Context, Effect, Layer, pipe } from "effect";
import { createStorage, prefixStorage, type Storage } from "unstorage";
import { default as memoryDriver } from "unstorage/drivers/memory";
import { default as redisDriver, RedisOptions } from "unstorage/drivers/redis";
import { DiscordGatewayLayer } from "./gateway";
import {
  membersWithReverseLookup,
  rolesWithReverseLookup,
  channelsWithReverseLookup,
  unstorageDriver,
  unstorageWithReverseLookupDriver,
} from "@/cache";

export class Unstorage extends Context.Tag("Unstorage")<Unstorage, Storage>() {
  static RedisLive = (opts: RedisOptions) =>
    Layer.succeed(Unstorage, createStorage({ driver: redisDriver(opts) }));

  static MemoryLive = Layer.succeed(Unstorage, createStorage({ driver: memoryDriver() }));

  static prefixed = (prefix: string) =>
    pipe(
      Unstorage,
      Effect.andThen((storage) => prefixStorage(storage, prefix)),
    );

  static PrefixedLive = (prefix: string) =>
    Layer.effectContext(
      pipe(
        Unstorage.prefixed(prefix),
        Effect.andThen((storage) => Context.make(Unstorage, storage)),
      ),
    );
}

export class GuildsCache extends Effect.Service<GuildsCache>()("GuildsCache", {
  scoped: pipe(
    Unstorage.prefixed("guilds:"),
    Effect.andThen((storage) => CachePrelude.guilds(unstorageDriver({ storage }))),
  ),
  dependencies: [DiscordGatewayLayer],
}) {}

export class RolesCache extends Effect.Service<RolesCache>()("RolesCache", {
  scoped: pipe(
    Unstorage.prefixed("roles:"),
    Effect.andThen((storage) =>
      rolesWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
  dependencies: [DiscordGatewayLayer],
}) {}

export class MembersCache extends Effect.Service<MembersCache>()("GuildMembersCache", {
  scoped: pipe(
    Unstorage.prefixed("members:"),
    Effect.andThen((storage) =>
      membersWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
  dependencies: [DiscordGatewayLayer],
}) {}

export class ChannelsCache extends Effect.Service<ChannelsCache>()("ChannelsCache", {
  scoped: pipe(
    Unstorage.prefixed("channels:"),
    Effect.andThen((storage) =>
      channelsWithReverseLookup(unstorageWithReverseLookupDriver({ storage })),
    ),
  ),
  dependencies: [DiscordGatewayLayer],
}) {}
