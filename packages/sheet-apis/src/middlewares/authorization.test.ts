import { describe, expect, it } from "@effect/vitest";
import { CacheNotFoundError, MembersApiCacheView } from "dfx-discord-utils/discord";
import { Cause, Effect, Redacted } from "effect";
import {
  hasUserPermission,
  requireBot,
  requireGuildMember,
  requireManageGuild,
  requireMonitorGuild,
  requireUserId,
  requireUserIdOrMonitorGuild,
} from "./authorization";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { GuildConfigService } from "@/services/guildConfig";

const withPermissions = <A, E, R>(
  permissions: Array<
    | "bot"
    | "app_owner"
    | `member_guild:${string}`
    | `monitor_guild:${string}`
    | `manage_guild:${string}`
    | `user:${string}`
  >,
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.provideService(SheetAuthUser, {
      accountId: "account-1",
      userId: "user-1",
      permissions,
      token: Redacted.make("token"),
    }),
  );

describe("authorization middleware helpers", () => {
  it("matches exact dynamic user permission", () =>
    Effect.gen(function* () {
      expect(hasUserPermission(["user:user-1"], "user-1")).toBe(true);
      expect(hasUserPermission(["user:user-1"], "user-2")).toBe(false);
    }));

  it("allows manage guild access with manage_guild", () =>
    Effect.gen(function* () {
      yield* withPermissions(["manage_guild:guild-1"], requireManageGuild("guild-1"));
    }));

  it("allows guild access shortcuts for app owner", () =>
    Effect.gen(function* () {
      yield* withPermissions(["app_owner"], requireGuildMember("guild-1"));
      yield* withPermissions(["app_owner"], requireMonitorGuild("guild-1"));
      yield* withPermissions(["app_owner"], requireManageGuild("guild-1"));
    }));

  it("allows monitor guild access with monitor_guild", () =>
    Effect.gen(function* () {
      yield* withPermissions(["monitor_guild:guild-1"], requireMonitorGuild("guild-1"));
    }));

  it("allows self access with matching user permission", () =>
    Effect.gen(function* () {
      yield* withPermissions(["user:user-1"], requireUserId("user-1"));
    }));

  it("allows self-or-monitor access with monitor permission", () =>
    Effect.gen(function* () {
      yield* withPermissions(
        ["monitor_guild:guild-1"],
        requireUserIdOrMonitorGuild("guild-1", "user-2"),
      );
    }));

  it("allows guild member access from membership service", () =>
    Effect.gen(function* () {
      yield* withPermissions([], requireGuildMember("guild-1")).pipe(
        Effect.provideService(MembersApiCacheView, {
          get: () => Effect.succeed({ roles: [] }),
        } as unknown as MembersApiCacheView),
      );
    }));

  it("does not trust member_guild without a matching live membership lookup", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withPermissions(["member_guild:guild-2"], requireGuildMember("guild-1")).pipe(
          Effect.provideService(MembersApiCacheView, {
            get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
          } as unknown as MembersApiCacheView),
        ),
      );

      expect(exit._tag).toBe("Failure");
    }));

  it("allows guild member access with a matching scoped permission", () =>
    Effect.gen(function* () {
      yield* withPermissions(["member_guild:guild-1"], requireGuildMember("guild-1")).pipe(
        Effect.provideService(MembersApiCacheView, {
          get: () => Effect.fail(new CacheNotFoundError({ message: "not needed" })),
        } as unknown as MembersApiCacheView),
      );
    }));

  it("allows guild monitor access from live membership and configured monitor roles", () =>
    Effect.gen(function* () {
      yield* withPermissions([], requireMonitorGuild("guild-1")).pipe(
        Effect.provideService(MembersApiCacheView, {
          get: () => Effect.succeed({ roles: ["role-1"] }),
        } as unknown as MembersApiCacheView),
        Effect.provideService(GuildConfigService, {
          getGuildMonitorRoles: () => Effect.succeed([{ roleId: "role-1" }]),
        } as unknown as GuildConfigService),
      );
    }));

  it("allows guild monitor access with a matching scoped permission", () =>
    Effect.gen(function* () {
      yield* withPermissions(["monitor_guild:guild-1"], requireMonitorGuild("guild-1")).pipe(
        Effect.provideService(MembersApiCacheView, {
          get: () => Effect.fail(new CacheNotFoundError({ message: "not needed" })),
        } as unknown as MembersApiCacheView),
        Effect.provideService(GuildConfigService, {
          getGuildMonitorRoles: () => Effect.succeed([{ roleId: "role-1" }]),
        } as unknown as GuildConfigService),
      );
    }));

  it("rejects monitor-only access without guild membership", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withPermissions(["monitor_guild:guild-1"], requireGuildMember("guild-1")).pipe(
          Effect.provideService(MembersApiCacheView, {
            get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
          } as unknown as MembersApiCacheView),
        ),
      );

      expect(exit._tag).toBe("Failure");
    }));

  it("does not trust monitor_guild without a matching live monitor role in the target guild", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withPermissions(["monitor_guild:guild-2"], requireMonitorGuild("guild-1")).pipe(
          Effect.provideService(MembersApiCacheView, {
            get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
          } as unknown as MembersApiCacheView),
          Effect.provideService(GuildConfigService, {
            getGuildMonitorRoles: () => Effect.succeed([{ roleId: "role-1" }]),
          } as unknown as GuildConfigService),
        ),
      );

      expect(exit._tag).toBe("Failure");
    }));

  it("rejects manage-only access without guild membership", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withPermissions(["manage_guild:guild-1"], requireGuildMember("guild-1")).pipe(
          Effect.provideService(MembersApiCacheView, {
            get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
          } as unknown as MembersApiCacheView),
        ),
      );

      expect(exit._tag).toBe("Failure");
    }));

  it("rejects guild member access on membership miss", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withPermissions([], requireGuildMember("guild-1")).pipe(
          Effect.provideService(MembersApiCacheView, {
            get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
          } as unknown as MembersApiCacheView),
        ),
      );

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
      }
    }));

  it("rejects missing bot permission for bot-only routes", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(withPermissions(["manage_guild:guild-1"], requireBot()));

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
      }
    }));

  it("rejects mismatched user permission", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(withPermissions(["user:user-1"], requireUserId("user-2")));

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
      }
    }));
});
