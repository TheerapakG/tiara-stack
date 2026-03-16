import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Cause, DateTime, Duration, Effect, Redacted, TestClock } from "effect";
import { Account } from "sheet-auth/client";
import { vi } from "vitest";
import { makeSheetAuthTokenAuthorization } from "./shared";

const { getAccountMock, getImplicitPermissionsMock } = vi.hoisted(() => ({
  getAccountMock: vi.fn(),
  getImplicitPermissionsMock: vi.fn(),
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

const makeAuthorization = () =>
  makeSheetAuthTokenAuthorization(fakeAuthClient).pipe(
    Effect.map((service) => service.sheetAuthToken),
  );

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

describe("SheetAuthTokenAuthorizationLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caches successful authorizations by token", () =>
    Effect.gen(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(
        Effect.succeed({ permissions: ["bot:manage_guild"] }),
      );

      const sheetAuthToken = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      const first = yield* sheetAuthToken(token);
      const second = yield* sheetAuthToken(token);

      expect(first).toEqual({
        userId: "user-1",
        permissions: ["bot:manage_guild"],
        token,
      });
      expect(second).toEqual(first);
      expect(getAccountMock).toHaveBeenCalledTimes(1);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(1);
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
