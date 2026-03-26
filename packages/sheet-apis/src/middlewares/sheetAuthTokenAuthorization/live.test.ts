import { HttpRouter, HttpServerRequest } from "@effect/platform";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Cause, DateTime, Duration, Effect, Option, Redacted, TestClock } from "effect";
import { Account } from "sheet-auth/client";
import type { ApplicationOwnerResolver } from "../../services/applicationOwner";
import { vi } from "vitest";
import { makeSheetAuthTokenAuthorization } from "./shared";

const { getAccountMock, getImplicitPermissionsMock, getOwnerIdMock } = vi.hoisted(() => ({
  getAccountMock: vi.fn(),
  getImplicitPermissionsMock: vi.fn(),
  getOwnerIdMock: vi.fn(),
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
const fakeApplicationOwnerResolver = {
  getOwnerId: getOwnerIdMock,
} as unknown as ApplicationOwnerResolver;

const makeAuthorization = () =>
  makeSheetAuthTokenAuthorization(fakeAuthClient, fakeApplicationOwnerResolver).pipe(
    Effect.map((service) => service.sheetAuthToken),
  );

const routeContext = {
  params: {},
  route: {},
} as unknown as HttpRouter.RouteContext;

const provideRequestContext = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E> =>
  effect.pipe(
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(new Request("http://localhost/test", { method: "GET" })),
    ),
    Effect.provideService(HttpServerRequest.ParsedSearchParams, {}),
    Effect.provideService(HttpRouter.RouteContext, routeContext),
  ) as Effect.Effect<A, E>;

const makeAccount = Effect.fnUntraced(function* (userId: string, accountId = `discord-${userId}`) {
  const now = yield* DateTime.now;
  return Account.make({
    userId,
    accountId,
    providerId: "discord",
    scopes: [],
    createdAt: now,
    updatedAt: now,
  });
});

describe("SheetAuthTokenAuthorizationLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerIdMock.mockReturnValue(Effect.succeed(Option.none()));
  });

  it.scoped("caches base authorization lookup for the same token", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(
        Effect.succeed({
          permissions: ["bot", "monitor_guild:guild-1", "manage_guild:guild-1"],
        }),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      const first = yield* provideRequestContext(sheetAuthToken(token));
      const second = yield* provideRequestContext(sheetAuthToken(token));

      expect(first).toEqual({
        accountId: "discord-user-1",
        userId: "user-1",
        permissions: ["bot", "account:discord:discord-user-1"],
        token,
      });
      expect(second).toEqual(first);
      expect(getAccountMock).toHaveBeenCalledTimes(1);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(1);
    }),
  );

  it.scoped(
    "skips guild lookups for bot accounts even when implicit permissions include guild roles",
    () =>
      Effect.gen(function* () {
        getAccountMock.mockReturnValue(makeAccount("user-1"));
        getImplicitPermissionsMock.mockReturnValue(
          Effect.succeed({
            permissions: [
              "bot",
              "monitor_guild:guild-1",
              "manage_guild:guild-1",
              "monitor_guild:guild-2",
              "manage_guild:guild-2",
            ],
          }),
        );

        const sheetAuthToken = yield* makeAuthorization();
        const token = Redacted.make("token-1");

        const first = yield* provideRequestContext(sheetAuthToken(token));
        const second = yield* provideRequestContext(sheetAuthToken(token));

        expect(first.permissions).toEqual(["bot", "account:discord:discord-user-1"]);
        expect(second.permissions).toEqual(["bot", "account:discord:discord-user-1"]);
      }),
  );

  it.scoped("appends app owner without deriving guild permissions", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("owner-user", "discord-owner"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getOwnerIdMock.mockReturnValue(Effect.succeed(Option.some("discord-owner")));

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* provideRequestContext(sheetAuthToken(Redacted.make("token-1")));

      expect(result.permissions).toEqual(["account:discord:discord-owner", "app_owner"]);
    }),
  );

  it.scoped("does not fail authorization when owner lookup fails", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getOwnerIdMock.mockReturnValue(Effect.fail(new Error("owner lookup failed")));

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* provideRequestContext(sheetAuthToken(Redacted.make("token-1")));

      expect(result.permissions).toEqual(["account:discord:discord-user-1"]);
    }),
  );

  it.scoped("uses distinct cache entries for distinct tokens", () =>
    Effect.gen(function* () {
      getAccountMock
        .mockReturnValueOnce(makeAccount("user-1"))
        .mockReturnValueOnce(makeAccount("user-2"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();

      const first = yield* provideRequestContext(sheetAuthToken(Redacted.make("token-1")));
      const second = yield* provideRequestContext(sheetAuthToken(Redacted.make("token-2")));

      expect(first.userId).toBe("user-1");
      expect(second.userId).toBe("user-2");
      expect(getAccountMock).toHaveBeenCalledTimes(2);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(2);
    }),
  );

  it.scoped("falls back to empty permissions when implicit permission lookup fails", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.fail(new Error("boom")));

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* provideRequestContext(sheetAuthToken(Redacted.make("token-1")));

      expect(result.permissions).toEqual(["account:discord:discord-user-1"]);
      expect(getAccountMock).toHaveBeenCalledTimes(1);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(1);
    }),
  );

  it.scoped("returns only base permissions", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();
      const result = yield* provideRequestContext(sheetAuthToken(Redacted.make("token-1")));

      expect(result.permissions).toEqual(["account:discord:discord-user-1"]);
    }),
  );

  it.scoped("maps account failures to Unauthorized", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(Effect.fail(new Error("ACCOUNT_NOT_FOUND")));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();
      const exit = yield* Effect.exit(
        provideRequestContext(sheetAuthToken(Redacted.make("token-1"))),
      );

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
    }),
  );

  it.scoped("expires successful cache entries after 30 seconds", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      yield* provideRequestContext(sheetAuthToken(token));
      yield* TestClock.adjust(Duration.seconds(31));
      yield* provideRequestContext(sheetAuthToken(token));

      expect(getAccountMock).toHaveBeenCalledTimes(2);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(2);
    }),
  );

  it.scoped("retries failed lookups after the failure ttl", () =>
    Effect.gen(function* () {
      getAccountMock
        .mockReturnValueOnce(Effect.fail(new Error("ACCOUNT_NOT_FOUND")))
        .mockReturnValueOnce(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const sheetAuthToken = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      yield* Effect.exit(provideRequestContext(sheetAuthToken(token)));
      yield* TestClock.adjust(Duration.seconds(2));
      const result = yield* provideRequestContext(sheetAuthToken(token));

      expect(result.userId).toBe("user-1");
      expect(getAccountMock).toHaveBeenCalledTimes(2);
    }),
  );
});
