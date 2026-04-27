import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { ChannelsCache, GuildsCache, MembersCache, RolesCache } from "./cache";
import { DiscordApplication } from "./gateway";
import { DiscordRpcs, discordRpcHandlersLayer } from "./rpc";

const member = {
  user: {
    id: "member-1",
    username: "member",
    avatar: null,
    discriminator: "0000",
    public_flags: 0,
    flags: 0,
    global_name: null,
    primary_guild: null,
  },
  nick: null,
  avatar: null,
  banner: null,
  roles: ["role-1"],
  premium_since: null,
  communication_disabled_until: null,
};

const cacheMiss = {
  _tag: "CacheMissError",
  cacheName: "MembersCache",
  id: "guild-1/member-1",
};

const makeCaches = ({
  memberResult = Effect.succeed(member),
  guildSize = Effect.succeed(2),
}: {
  readonly memberResult?: Effect.Effect<typeof member, unknown, never>;
  readonly guildSize?: Effect.Effect<number, unknown, never>;
} = {}) => ({
  guilds: {
    size: guildSize,
  },
  channels: {},
  roles: {},
  members: {
    get: () => memberResult,
  },
});

const run = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  caches: ReturnType<typeof makeCaches> = makeCaches(),
) => {
  const provided = effect.pipe(
    Effect.provide(discordRpcHandlersLayer),
    Effect.provideService(DiscordApplication, {
      owner: { id: "owner-1" },
    } as never),
    Effect.provideService(GuildsCache, caches.guilds as never),
    Effect.provideService(ChannelsCache, caches.channels as never),
    Effect.provideService(RolesCache, caches.roles as never),
    Effect.provideService(MembersCache, caches.members as never),
  ) as Effect.Effect<A, E, never>;

  return Effect.runPromise(Effect.scoped(provided));
};

const makeClient = RpcTest.makeClient(DiscordRpcs, { flatten: true });

describe("DiscordRpcs handlers", () => {
  it("cache.getMember returns { value }", async () => {
    const result = await run(
      Effect.gen(function* () {
        const client = yield* makeClient;
        return yield* client("cache.getMember", {
          params: { parentId: "guild-1", resourceId: "member-1" },
        });
      }),
    );

    expect(result).toEqual({ value: member });
  });

  it("cache.getMember converts cache misses to CacheNotFoundError", async () => {
    const result = await run(
      Effect.gen(function* () {
        const client = yield* makeClient;
        return yield* Effect.result(
          client("cache.getMember", {
            params: { parentId: "guild-1", resourceId: "member-1" },
          }),
        );
      }),
      makeCaches({ memberResult: Effect.fail(cacheMiss) }),
    );

    Result.match(result, {
      onFailure: (error) => expect(error._tag).toBe("CacheNotFoundError"),
      onSuccess: () => expect.fail("Expected cache.getMember to fail"),
    });
  });

  it("cache.getGuildSize returns { size }", async () => {
    const result = await run(
      Effect.gen(function* () {
        const client = yield* makeClient;
        return yield* client("cache.getGuildSize", undefined);
      }),
    );

    expect(result).toEqual({ size: 2 });
  });

  it("application.getApplication returns { ownerId }", async () => {
    const result = await run(
      Effect.gen(function* () {
        const client = yield* makeClient;
        return yield* client("application.getApplication", undefined);
      }),
    );

    expect(result).toEqual({ ownerId: "owner-1" });
  });
});
