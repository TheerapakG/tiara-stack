import { Cache, Discord, DiscordREST } from "dfx";
import { CachePrelude, DiscordGateway } from "dfx/gateway";
import { Effect, Stream } from "effect";
import { CacheMissError, ParentCacheDriver, makeWithParent } from "dfx/Cache";
import { DiscordGatewayLayer } from "./gateway";

const membersCachePrelude = <RM, EM, E>(
  makeDriver: Effect.Effect<
    ParentCacheDriver<
      E,
      Omit<Discord.GuildMemberResponse, "deaf" | "flags" | "joined_at" | "mute">
    >,
    EM,
    RM
  >,
) =>
  Effect.gen(function* () {
    const driver = yield* makeDriver;
    const gateway = yield* DiscordGateway;
    const rest = yield* DiscordREST;

    return yield* makeWithParent({
      driver,
      id: (_) => Effect.fail(new CacheMissError({ cacheName: "MembersCache/id", id: _.user.id })),
      ops: CachePrelude.opsWithParent({
        id: (a: Omit<Discord.GuildMemberResponse, "deaf" | "flags" | "joined_at" | "mute">) =>
          a.user.id,
        fromParent: Stream.map(gateway.fromDispatch("GUILD_CREATE"), (g) => [g.id, g.members]),
        create: Stream.map(gateway.fromDispatch("GUILD_MEMBER_ADD"), (r) => [r.guild_id, r]),
        update: Stream.map(gateway.fromDispatch("GUILD_MEMBER_UPDATE"), (r) => [r.guild_id, r]),
        remove: Stream.map(gateway.fromDispatch("GUILD_MEMBER_REMOVE"), (r) => [
          r.guild_id,
          r.user.id,
        ]),
        parentRemove: Stream.map(gateway.fromDispatch("GUILD_DELETE"), (g) => g.id),
      }),
      onMiss: (_, id) => Effect.fail(new CacheMissError({ cacheName: "MembersCache", id })),
      onParentMiss: (guildId) =>
        rest
          .listGuildMembers(guildId)
          .pipe(Effect.map((_) => _.map((member) => [member.user.id, member]))),
    });
  });

export const makeGuildsCache = () =>
  Effect.Service<GuildsCache>()("GuildsCache", {
    scoped: CachePrelude.guilds(Cache.memoryDriver()),
    dependencies: [DiscordGatewayLayer],
  });

export class GuildsCache extends Effect.Service<GuildsCache>()("GuildsCache", {
  scoped: CachePrelude.guilds(Cache.memoryDriver()),
  dependencies: [DiscordGatewayLayer],
}) {}

export class RolesCache extends Effect.Service<RolesCache>()("RolesCache", {
  scoped: CachePrelude.roles(Cache.memoryParentDriver()),
  dependencies: [DiscordGatewayLayer],
}) {}

export class MembersCache extends Effect.Service<MembersCache>()("GuildMembersCache", {
  scoped: membersCachePrelude(Cache.memoryParentDriver()),
  dependencies: [DiscordGatewayLayer],
}) {}

export class ChannelsCache extends Effect.Service<ChannelsCache>()("ChannelsCache", {
  scoped: CachePrelude.channels(Cache.memoryParentDriver()),
  dependencies: [DiscordGatewayLayer],
}) {}
