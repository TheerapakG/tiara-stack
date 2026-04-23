import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import { Cause, DateTime, Duration, Effect, Exit, Option, Redacted, Ref, Context } from "effect";
import { vi } from "vitest";
import type { Account } from "sheet-auth/model";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";
import { permissionSetFromIterable } from "@/services/authorization";
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
};

const makeAuthorization = () =>
  makeSheetAuthTokenAuthorization(fakeAuthClient, fakeApplicationOwnerResolver);

const routeContext = {
  params: {},
  route: HttpRouter.route("GET", "/test", Effect.succeed(HttpServerResponse.empty())),
};

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
  return {
    _tag: "Account",
    userId,
    accountId,
    providerId: "discord",
    scopes: [],
    createdAt: now,
    updatedAt: now,
  } satisfies Account;
});

const permissionValues = (permissions: ReturnType<typeof permissionSetFromIterable>) =>
  Array.from(permissions).sort();

const runSheetAuthToken = Effect.fnUntraced(function* (
  authorization: Effect.Success<ReturnType<typeof makeAuthorization>>,
  token: Redacted.Redacted<string>,
) {
  const currentUserRef = yield* Ref.make<
    Option.Option<Context.Service.Shape<typeof SheetAuthUser>>
  >(Option.none());

  yield* provideRequestContext(
    authorization.sheetAuthToken(
      Effect.fnUntraced(function* () {
        const currentUser = yield* SheetAuthUser;
        yield* Ref.set(currentUserRef, Option.some(currentUser));
        return HttpServerResponse.empty();
      })(),
      {
        credential: token,
        endpoint: {} as never,
        group: {} as never,
      },
    ),
  );

  return Option.getOrElse(yield* Ref.get(currentUserRef), () => {
    throw new Error("SheetAuthUser was not provided");
  });
});

describe("SheetAuthTokenAuthorizationLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerIdMock.mockReturnValue(Effect.succeed(Option.none()));
  });

  it.effect(
    "caches base authorization lookup for the same token",
    Effect.fnUntraced(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(
        Effect.succeed({
          permissions: ["bot", "monitor_guild:guild-1", "manage_guild:guild-1"],
        }),
      );

      const authorization = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      const first = yield* runSheetAuthToken(authorization, token);
      const second = yield* runSheetAuthToken(authorization, token);

      expect(first.accountId).toBe("discord-user-1");
      expect(first.userId).toBe("user-1");
      expect(first.token).toBe(token);
      expect(permissionValues(first.permissions)).toEqual([
        "account:discord:discord-user-1",
        "bot",
      ]);
      expect(second).toEqual(first);
      expect(getAccountMock).toHaveBeenCalledTimes(1);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(1);
    }),
  );

  it.effect(
    "skips guild lookups for bot accounts even when implicit permissions include guild roles",
    Effect.fnUntraced(function* () {
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

      const authorization = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      const first = yield* runSheetAuthToken(authorization, token);
      const second = yield* runSheetAuthToken(authorization, token);

      expect(permissionValues(first.permissions)).toEqual([
        "account:discord:discord-user-1",
        "bot",
      ]);
      expect(permissionValues(second.permissions)).toEqual([
        "account:discord:discord-user-1",
        "bot",
      ]);
    }),
  );

  it.effect(
    "appends app owner without deriving guild permissions",
    Effect.fnUntraced(function* () {
      getAccountMock.mockReturnValue(makeAccount("owner-user", "discord-owner"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getOwnerIdMock.mockReturnValue(Effect.succeed(Option.some("discord-owner")));

      const authorization = yield* makeAuthorization();
      const result = yield* runSheetAuthToken(authorization, Redacted.make("token-1"));

      expect(permissionValues(result.permissions)).toEqual([
        "account:discord:discord-owner",
        "app_owner",
      ]);
    }),
  );

  it.effect(
    "does not fail authorization when owner lookup fails",
    Effect.fnUntraced(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));
      getOwnerIdMock.mockReturnValue(Effect.fail(new Error("owner lookup failed")));

      const authorization = yield* makeAuthorization();
      const result = yield* runSheetAuthToken(authorization, Redacted.make("token-1"));

      expect(permissionValues(result.permissions)).toEqual(["account:discord:discord-user-1"]);
    }),
  );

  it.effect(
    "uses distinct cache entries for distinct tokens",
    Effect.fnUntraced(function* () {
      getAccountMock
        .mockReturnValueOnce(makeAccount("user-1"))
        .mockReturnValueOnce(makeAccount("user-2"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const authorization = yield* makeAuthorization();

      const first = yield* runSheetAuthToken(authorization, Redacted.make("token-1"));
      const second = yield* runSheetAuthToken(authorization, Redacted.make("token-2"));

      expect(first.userId).toBe("user-1");
      expect(second.userId).toBe("user-2");
      expect(getAccountMock).toHaveBeenCalledTimes(2);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(2);
    }),
  );

  it.effect(
    "falls back to empty permissions when implicit permission lookup fails",
    Effect.fnUntraced(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.fail(new Error("boom")));

      const authorization = yield* makeAuthorization();
      const result = yield* runSheetAuthToken(authorization, Redacted.make("token-1"));

      expect(permissionValues(result.permissions)).toEqual(["account:discord:discord-user-1"]);
      expect(getAccountMock).toHaveBeenCalledTimes(1);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(1);
    }),
  );

  it.effect(
    "returns only base permissions",
    Effect.fnUntraced(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const authorization = yield* makeAuthorization();
      const result = yield* runSheetAuthToken(authorization, Redacted.make("token-1"));

      expect(permissionValues(result.permissions)).toEqual(["account:discord:discord-user-1"]);
    }),
  );

  it.effect(
    "maps account failures to Unauthorized",
    Effect.fnUntraced(function* () {
      getAccountMock.mockReturnValue(Effect.fail(new Error("ACCOUNT_NOT_FOUND")));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const authorization = yield* makeAuthorization();
      const exit = yield* Effect.exit(runSheetAuthToken(authorization, Redacted.make("token-1")));

      expect(exit._tag).toBe("Failure");
      if (Exit.isFailure(exit)) {
        const failure = Cause.findErrorOption(exit.cause);
        if (Option.isSome(failure)) {
          expect((failure.value as { message: string }).message).toContain(
            "Invalid sheet-auth token: ACCOUNT_NOT_FOUND",
          );
        }
      }
    }),
  );

  it.effect(
    "expires successful cache entries after 30 seconds",
    Effect.fnUntraced(function* () {
      getAccountMock.mockReturnValue(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const authorization = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      yield* runSheetAuthToken(authorization, token);
      yield* TestClock.adjust(Duration.seconds(31));
      yield* runSheetAuthToken(authorization, token);

      expect(getAccountMock).toHaveBeenCalledTimes(2);
      expect(getImplicitPermissionsMock).toHaveBeenCalledTimes(2);
    }),
  );

  it.effect(
    "retries failed lookups after the failure ttl",
    Effect.fnUntraced(function* () {
      getAccountMock
        .mockReturnValueOnce(Effect.fail(new Error("ACCOUNT_NOT_FOUND")))
        .mockReturnValueOnce(makeAccount("user-1"));
      getImplicitPermissionsMock.mockReturnValue(Effect.succeed({ permissions: [] }));

      const authorization = yield* makeAuthorization();
      const token = Redacted.make("token-1");

      yield* Effect.exit(runSheetAuthToken(authorization, token));
      yield* TestClock.adjust(Duration.seconds(2));
      const result = yield* runSheetAuthToken(authorization, token);

      expect(result.userId).toBe("user-1");
      expect(getAccountMock).toHaveBeenCalledTimes(2);
    }),
  );
});
