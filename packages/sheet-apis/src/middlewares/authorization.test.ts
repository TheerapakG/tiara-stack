import { describe, expect, it } from "@effect/vitest";
import {
  CacheNotFoundError,
  MembersApiCacheView,
  RolesApiCacheView,
} from "dfx-discord-utils/discord";
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

const defaultMembersApiCacheView = {
  get: () => Effect.fail(new CacheNotFoundError({ message: "not needed" })),
} as unknown as MembersApiCacheView;

const defaultGuildConfigService = {
  getGuildMonitorRoles: () => Effect.succeed([{ roleId: "role-1" }]),
} as unknown as GuildConfigService;

const defaultRolesApiCacheView = {
  getForParent: () => Effect.fail(new CacheNotFoundError({ message: "not needed" })),
} as unknown as RolesApiCacheView;

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

const provideAuthorizationServices =
  (options?: {
    readonly membersApiCacheView?: MembersApiCacheView;
    readonly guildConfigService?: GuildConfigService;
    readonly rolesApiCacheView?: RolesApiCacheView;
  }) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(
        MembersApiCacheView,
        options?.membersApiCacheView ?? defaultMembersApiCacheView,
      ),
      Effect.provideService(
        GuildConfigService,
        options?.guildConfigService ?? defaultGuildConfigService,
      ),
      Effect.provideService(
        RolesApiCacheView,
        options?.rolesApiCacheView ?? defaultRolesApiCacheView,
      ),
    );

describe("authorization middleware helpers", () => {
  it.effect("matches exact dynamic user permission", () =>
    Effect.gen(function* () {
      expect(hasUserPermission(["user:user-1"], "user-1")).toBe(true);
      expect(hasUserPermission(["user:user-1"], "user-2")).toBe(false);
    }),
  );

  it.effect("allows manage guild access with manage_guild", () =>
    Effect.gen(function* () {
      yield* withPermissions(["manage_guild:guild-1"], requireManageGuild("guild-1")).pipe(
        provideAuthorizationServices(),
      );
    }),
  );

  it.effect("allows guild access shortcuts for app owner", () =>
    Effect.gen(function* () {
      yield* withPermissions(["app_owner"], requireGuildMember("guild-1")).pipe(
        provideAuthorizationServices(),
      );
      yield* withPermissions(["app_owner"], requireMonitorGuild("guild-1")).pipe(
        provideAuthorizationServices(),
      );
      yield* withPermissions(["app_owner"], requireManageGuild("guild-1")).pipe(
        provideAuthorizationServices(),
      );
    }),
  );

  it.effect("allows monitor guild access with monitor_guild", () =>
    Effect.gen(function* () {
      yield* withPermissions(["monitor_guild:guild-1"], requireMonitorGuild("guild-1")).pipe(
        provideAuthorizationServices(),
      );
    }),
  );

  it.effect("allows self access with matching user permission", () =>
    Effect.gen(function* () {
      yield* withPermissions(["user:user-1"], requireUserId("user-1"));
    }),
  );

  it.effect("allows self-or-monitor access with monitor permission", () =>
    Effect.gen(function* () {
      yield* withPermissions(
        ["monitor_guild:guild-1"],
        requireUserIdOrMonitorGuild("guild-1", "user-2"),
      ).pipe(provideAuthorizationServices());
    }),
  );

  it.effect("allows guild member access from membership service", () =>
    Effect.gen(function* () {
      yield* withPermissions([], requireGuildMember("guild-1")).pipe(
        provideAuthorizationServices({
          membersApiCacheView: {
            get: () => Effect.succeed({ roles: [] }),
          } as unknown as MembersApiCacheView,
        }),
      );
    }),
  );

  it.effect("does not trust member_guild without a matching live membership lookup", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withPermissions(["member_guild:guild-2"], requireGuildMember("guild-1")).pipe(
          provideAuthorizationServices({
            membersApiCacheView: {
              get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
            } as unknown as MembersApiCacheView,
          }),
        ),
      );

      expect(exit._tag).toBe("Failure");
    }),
  );

  it.effect("allows guild member access with a matching scoped permission", () =>
    Effect.gen(function* () {
      yield* withPermissions(["member_guild:guild-1"], requireGuildMember("guild-1")).pipe(
        provideAuthorizationServices(),
      );
    }),
  );

  it.effect("allows guild monitor access from live membership and configured monitor roles", () =>
    Effect.gen(function* () {
      yield* withPermissions([], requireMonitorGuild("guild-1")).pipe(
        provideAuthorizationServices({
          membersApiCacheView: {
            get: () => Effect.succeed({ roles: ["role-1"] }),
          } as unknown as MembersApiCacheView,
          guildConfigService: {
            getGuildMonitorRoles: () => Effect.succeed([{ roleId: "role-1" }]),
          } as unknown as GuildConfigService,
        }),
      );
    }),
  );

  it.effect("allows guild monitor access with a matching scoped permission", () =>
    Effect.gen(function* () {
      yield* withPermissions(["monitor_guild:guild-1"], requireMonitorGuild("guild-1")).pipe(
        provideAuthorizationServices(),
      );
    }),
  );

  it.effect("rejects monitor-only access without guild membership", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withPermissions(["monitor_guild:guild-1"], requireGuildMember("guild-1")).pipe(
          provideAuthorizationServices({
            membersApiCacheView: {
              get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
            } as unknown as MembersApiCacheView,
          }),
        ),
      );

      expect(exit._tag).toBe("Failure");
    }),
  );

  it.effect(
    "does not trust monitor_guild without a matching live monitor role in the target guild",
    () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          withPermissions(["monitor_guild:guild-2"], requireMonitorGuild("guild-1")).pipe(
            provideAuthorizationServices({
              membersApiCacheView: {
                get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
              } as unknown as MembersApiCacheView,
              guildConfigService: {
                getGuildMonitorRoles: () => Effect.succeed([{ roleId: "role-1" }]),
              } as unknown as GuildConfigService,
            }),
          ),
        );

        expect(exit._tag).toBe("Failure");
      }),
  );

  it.effect("rejects manage-only access without guild membership", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withPermissions(["manage_guild:guild-1"], requireGuildMember("guild-1")).pipe(
          provideAuthorizationServices({
            membersApiCacheView: {
              get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
            } as unknown as MembersApiCacheView,
          }),
        ),
      );

      expect(exit._tag).toBe("Failure");
    }),
  );

  it.effect("rejects guild member access on membership miss", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withPermissions([], requireGuildMember("guild-1")).pipe(
          provideAuthorizationServices({
            membersApiCacheView: {
              get: () => Effect.fail(new CacheNotFoundError({ message: "not found" })),
            } as unknown as MembersApiCacheView,
          }),
        ),
      );

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
      }
    }),
  );

  it.effect("rejects missing bot permission for bot-only routes", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(withPermissions(["manage_guild:guild-1"], requireBot()));

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
      }
    }),
  );

  it.effect("rejects mismatched user permission", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(withPermissions(["user:user-1"], requireUserId("user-2")));

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
      }
    }),
  );
});
