import { HttpServerRequest } from "@effect/platform";
import { Discord } from "dfx";
import type { MembersApiCacheView, RolesApiCacheView } from "dfx-discord-utils/discord";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Cause, DateTime, Duration, Effect, Redacted, TestClock } from "effect";
import { Account } from "sheet-auth/client";
import type { GuildConfigService } from "../../services";
import { vi } from "vitest";
import { makeSheetAuthTokenAuthorization } from "./shared";

const {
  getAccountMock,
  getImplicitPermissionsMock,
  getGuildMonitorRolesMock,
  membersGetMock,
  rolesGetForParentMock,
} = vi.hoisted(() => ({
  getAccountMock: vi.fn(),
  getImplicitPermissionsMock: vi.fn(),
  getGuildMonitorRolesMock: vi.fn(),
  membersGetMock: vi.fn(),
  rolesGetForParentMock: vi.fn(),
}));

vi.mock("sheet-auth/client", async () => {
  const actual = await vi.importActual<typeof import("sheet-auth/client")>("sheet-auth/client");

  return {
    ...actual,
    getAccount: getAccountMock,
    getKubernetesOAuthImplicitPermissions: getImplicitPermissionsMock,
  };
});

const fakeAuthClient = {} as import("sheet-auth/client").SheetAuthClient;
const fakeGuildConfigService = {
  getGuildMonitorRoles: getGuildMonitorRolesMock,
} as unknown as GuildConfigService;
const fakeMembersCache = {
  get: membersGetMock,
} as unknown as MembersApiCacheView;
const fakeRolesCache = {
  getForParent: rolesGetForParentMock,
} as unknown as RolesApiCacheView;

const makeAuthorization = () =>
  makeSheetAuthTokenAuthorization(
    fakeAuthClient,
    fakeGuildConfigService,
    fakeMembersCache,
    fakeRolesCache,
  ).pipe(Effect.map((service) => service.sheetAuthToken));

const withSearchParams = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  searchParams?: Readonly<Record<string, string | Array<string>>>,
) =>
  searchParams === undefined
    ? effect
    : effect.pipe(Effect.provideService(HttpServerRequest.ParsedSearchParams, searchParams));

const makeAccount = Effect.fnUntraced(function* (userId: string) {
  const now = yield* DateTime.now;
  return Account.make({
    userId,
    accountId: `account-${userId}`,
    providerId: "discord",
    scopes: [],
    createdAt: now,
    updatedAt: now,
  });
});

const makeMember = (roles: string[]) =>
  ({
    roles,
    user: { id: "account-user-1" },
  }) as const;

const makeRole = (id: string, permissions: bigint | string) =>
  ({
    id,
    permissions: permissions.toString(),
  }) as const;

describe("SheetAuthTokenAuthorizationLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caches base authorization lookup for the same token", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(
        Effect.succeed({ permissions: ["bot", "monitor_guild", "manage_guild"] }),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      const first = yield* withSearchParams(sheetAuthToken(token), { guildId: "guild-1" });
      const second = yield* withSearchParams(sheetAuthToken(token), { guildId: "guild-1" });

      expect(first).toEqual({
        userId: "user-1",
        permissions: ["bot", "monitor_guild", "manage_guild"],
        token,
      });
      expect(second).toEqual(first);
      expect(getAccountMock).toHaveBeenCalledTimes(1);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(1);
    }));

  it("short-circuits guild lookups when base permissions already contain guild capabilities", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(
        Effect.succeed({ permissions: ["bot", "monitor_guild", "manage_guild"] }),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      yield* withSearchParams(sheetAuthToken(token), { guildId: "guild-1" });
      yield* withSearchParams(sheetAuthToken(token), { guildId: "guild-2" });

      expect(getGuildMonitorRolesMock).not.toHaveBeenCalled();
      expect(membersGetMock).not.toHaveBeenCalled();
      expect(rolesGetForParentMock).not.toHaveBeenCalled();
    }));

  it("uses distinct cache entries for distinct tokens", () =>
    Effect.gen(function* () {
      getAccountMock
        .mockReturnValueOnce(makeAccount("user-1"))
        .mockReturnValueOnce(makeAccount("user-2"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();

      const first = yield* sheetAuthToken(Redacted.make("token-1"));
      const second = yield* sheetAuthToken(Redacted.make("token-2"));

      expect(first.userId).toBe("user-1");
      expect(second.userId).toBe("user-2");
      expect(getAccountMock).toHaveBeenCalledTimes(2);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(2);
    }));

  it("falls back to empty permissions when implicit permission lookup fails", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.fail(new Error("boom")));

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* sheetAuthToken(Redacted.make("token-1"));

      expect(result.permissions).toEqual([]);
      expect(getAccountMock).toHaveBeenCalledTimes(1);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(1);
    }));

  it("returns only base permissions when the request has no guildId", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* withSearchParams(sheetAuthToken(Redacted.make("token-1")), {});

      expect(result.permissions).toEqual([]);
      expect(getGuildMonitorRolesMock).not.toHaveBeenCalled();
      expect(membersGetMock).not.toHaveBeenCalled();
      expect(rolesGetForParentMock).not.toHaveBeenCalled();
    }));

  it("adds monitor permission when the member has a configured monitor role", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getGuildMonitorRolesMock.mockReturnValue(Effect.succeed([{ roleId: "role-1" }]));
      membersGetMock.mockReturnValue(Effect.succeed(makeMember(["role-1", "role-2"])));
      rolesGetForParentMock.mockReturnValue(Effect.succeed(new Map()));

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* withSearchParams(sheetAuthToken(Redacted.make("token-1")), {
        guildId: "guild-1",
      });

      expect(result.permissions).toEqual(["monitor_guild"]);
      expect(getGuildMonitorRolesMock).toHaveBeenCalledWith("guild-1");
      expect(membersGetMock).toHaveBeenCalledWith("guild-1", "account-user-1");
    }));

  it("adds manage guild permission when the member has manage guild", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getGuildMonitorRolesMock.mockReturnValue(Effect.succeed([]));
      membersGetMock.mockReturnValue(Effect.succeed(makeMember(["role-2"])));
      rolesGetForParentMock.mockReturnValue(
        Effect.succeed(new Map([["role-2", makeRole("role-2", Discord.Permissions.ManageGuild)]])),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* withSearchParams(sheetAuthToken(Redacted.make("token-1")), {
        guildId: "guild-1",
      });

      expect(result.permissions).toEqual(["manage_guild"]);
    }));

  it("derives monitor and manage guild permissions together", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getGuildMonitorRolesMock.mockReturnValue(Effect.succeed([{ roleId: "role-1" }]));
      membersGetMock.mockReturnValue(Effect.succeed(makeMember(["role-1", "role-2"])));
      rolesGetForParentMock.mockReturnValue(
        Effect.succeed(new Map([["role-2", makeRole("role-2", Discord.Permissions.ManageGuild)]])),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* withSearchParams(sheetAuthToken(Redacted.make("token-1")), {
        guildId: "guild-1",
      });

      expect(result.permissions).toEqual(["monitor_guild", "manage_guild"]);
    }));

  it("does not add derived permissions when the member is not a monitor and lacks manage guild", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getGuildMonitorRolesMock.mockReturnValue(Effect.succeed([{ roleId: "role-1" }]));
      membersGetMock.mockReturnValue(Effect.succeed(makeMember(["role-2"])));
      rolesGetForParentMock.mockReturnValue(
        Effect.succeed(new Map([["role-2", makeRole("role-2", 0n)]])),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* withSearchParams(sheetAuthToken(Redacted.make("token-1")), {
        guildId: "guild-1",
      });

      expect(result.permissions).toEqual([]);
    }));

  it("skips monitor permission when no monitor roles are configured", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getGuildMonitorRolesMock.mockReturnValue(Effect.succeed([]));
      membersGetMock.mockReturnValue(Effect.succeed(makeMember(["role-2"])));
      rolesGetForParentMock.mockReturnValue(
        Effect.succeed(new Map([["role-2", makeRole("role-2", 0n)]])),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* withSearchParams(sheetAuthToken(Redacted.make("token-1")), {
        guildId: "guild-1",
      });

      expect(result.permissions).toEqual([]);
      expect(membersGetMock).toHaveBeenCalledWith("guild-1", "account-user-1");
    }));

  it("skips derived permissions when member lookup fails", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getGuildMonitorRolesMock.mockReturnValue(Effect.succeed([{ roleId: "role-1" }]));
      membersGetMock.mockReturnValue(Effect.fail(new Error("member lookup failed")));

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* withSearchParams(sheetAuthToken(Redacted.make("token-1")), {
        guildId: "guild-1",
      });

      expect(result.permissions).toEqual([]);
      expect(rolesGetForParentMock).not.toHaveBeenCalled();
    }));

  it("skips monitor permission when guild monitor role lookup fails", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getGuildMonitorRolesMock.mockReturnValue(Effect.fail(new Error("role lookup failed")));
      membersGetMock.mockReturnValue(Effect.succeed(makeMember(["role-1", "role-2"])));
      rolesGetForParentMock.mockReturnValue(
        Effect.succeed(new Map([["role-2", makeRole("role-2", Discord.Permissions.ManageGuild)]])),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* withSearchParams(sheetAuthToken(Redacted.make("token-1")), {
        guildId: "guild-1",
      });

      expect(result.permissions).toEqual(["manage_guild"]);
    }));

  it("skips manage guild permission when role lookup fails", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getGuildMonitorRolesMock.mockReturnValue(Effect.succeed([{ roleId: "role-1" }]));
      membersGetMock.mockReturnValue(Effect.succeed(makeMember(["role-1", "role-2"])));
      rolesGetForParentMock.mockReturnValue(Effect.fail(new Error("roles lookup failed")));

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* withSearchParams(sheetAuthToken(Redacted.make("token-1")), {
        guildId: "guild-1",
      });

      expect(result.permissions).toEqual(["monitor_guild"]);
    }));

  it("does not cache guild-scoped permissions across requests", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getGuildMonitorRolesMock.mockImplementation((guildId: string) =>
        guildId === "guild-1"
          ? Effect.succeed([{ roleId: "role-1" }])
          : Effect.succeed([{ roleId: "role-2" }]),
      );
      membersGetMock.mockImplementation((guildId: string) =>
        guildId === "guild-1"
          ? Effect.succeed(makeMember(["role-1"]))
          : Effect.succeed(makeMember(["role-3"])),
      );
      rolesGetForParentMock.mockImplementation((guildId: string) =>
        guildId === "guild-1"
          ? Effect.succeed(
              new Map([["role-1", makeRole("role-1", Discord.Permissions.ManageGuild)]]),
            )
          : Effect.succeed(new Map([["role-3", makeRole("role-3", 0n)]])),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      const first = yield* withSearchParams(sheetAuthToken(token), { guildId: "guild-1" });
      const second = yield* withSearchParams(sheetAuthToken(token), { guildId: "guild-2" });

      expect(first.permissions).toEqual(["monitor_guild", "manage_guild"]);
      expect(second.permissions).toEqual([]);
      expect(getAccountMock).toHaveBeenCalledTimes(1);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(1);
      expect(getGuildMonitorRolesMock).toHaveBeenCalledTimes(2);
      expect(membersGetMock).toHaveBeenCalledTimes(2);
      expect(rolesGetForParentMock).toHaveBeenCalledTimes(2);
    }));

  it("maps account failures to Unauthorized", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(Effect.fail(new Error("ACCOUNT_NOT_FOUND")));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();
      const exit = yield* Effect.exit(sheetAuthToken(Redacted.make("token-1")));

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
        if (failure._tag === "Some") {
          expect((failure.value as { message: string }).message).toContain(
            "Invalid sheet-auth token: ACCOUNT_NOT_FOUND",
          );
        }
      }
    }));

  it("expires successful cache entries after 30 seconds", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      yield* sheetAuthToken(token);
      yield* TestClock.adjust(Duration.seconds(31));
      yield* sheetAuthToken(token);

      expect(getAccountMock).toHaveBeenCalledTimes(2);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(2);
    }));

  it("retries failed lookups after the failure ttl", () =>
    Effect.gen(function* () {
      getAccountMock
        .mockReturnValueOnce(Effect.fail(new Error("ACCOUNT_NOT_FOUND")))
        .mockReturnValueOnce(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      yield* Effect.exit(sheetAuthToken(token));
      yield* TestClock.adjust(Duration.seconds(2));
      const result = yield* sheetAuthToken(token);

      expect(result.userId).toBe("user-1");
      expect(getAccountMock).toHaveBeenCalledTimes(2);
    }));
});
