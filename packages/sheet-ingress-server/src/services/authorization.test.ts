import { describe, expect, it, vi } from "vitest";
import { Cause, Effect, Exit, HashSet, Layer, Redacted } from "effect";
import { SheetAuthUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthUser";
import { Unauthorized } from "sheet-ingress-api/schemas/middlewares/unauthorized";
import {
  AuthorizationService,
  hasDiscordAccountPermission,
  hasGuildPermission,
  hasPermission,
  permissionSetFromIterable,
} from "./authorization";
import { SheetApisClient } from "./sheetApisClient";

const makeUser = (permissions: Iterable<string> = []) => ({
  accountId: "discord-user-1",
  userId: "user-1",
  permissions: HashSet.fromIterable(permissions),
  token: Redacted.make("token-1"),
});

const makeSheetApisClient = (permissions: Iterable<string>) => {
  const resolveTokenPermissions = vi.fn(
    ({ payload }: { payload: { token: Redacted.Redacted<string>; guildId?: string } }) =>
      Effect.succeed({
        accountId: "discord-user-1",
        userId: "user-1",
        permissions: permissionSetFromIterable(permissions as never),
        guildId: payload.guildId,
      }),
  );

  return {
    client: {
      withServiceUser: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
      permissions: {
        resolveTokenPermissions,
      },
    } as never,
    resolveTokenPermissions,
  };
};

const runAuthorization = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  {
    user = makeUser(),
    sheetApisClient = makeSheetApisClient([]).client,
  }: {
    readonly user?: ReturnType<typeof makeUser>;
    readonly sheetApisClient?: typeof SheetApisClient.Service;
  } = {},
) => {
  const authorizationLayer = Layer.effect(AuthorizationService, AuthorizationService.make);
  const provided = effect.pipe(
    Effect.provide(authorizationLayer),
    Effect.provideService(SheetAuthUser, user),
    Effect.provideService(SheetApisClient, sheetApisClient),
  );

  return provided;
};

describe("authorization permission helpers", () => {
  it("matches base, guild-scoped, and Discord account permissions", () => {
    const permissions = permissionSetFromIterable([
      "service",
      "monitor_guild:guild-1",
      "account:discord:discord-user-1",
    ]);

    expect(hasPermission(permissions, "service")).toBe(true);
    expect(hasGuildPermission(permissions, "monitor_guild", "guild-1")).toBe(true);
    expect(hasGuildPermission(permissions, "monitor_guild", "guild-2")).toBe(false);
    expect(hasDiscordAccountPermission(permissions, "discord-user-1")).toBe(true);
    expect(hasDiscordAccountPermission(permissions, "discord-user-2")).toBe(false);
  });
});

describe("AuthorizationService", () => {
  it("allows service users through requireService", async () => {
    await Effect.runPromise(
      runAuthorization(
        Effect.gen(function* () {
          const authorization = yield* AuthorizationService;
          yield* authorization.requireService();
        }),
        { user: makeUser(["service"]) },
      ),
    );
  });

  it("rejects non-service users from requireService", async () => {
    const exit = await Effect.runPromiseExit(
      runAuthorization(
        Effect.gen(function* () {
          const authorization = yield* AuthorizationService;
          yield* authorization.requireService();
        }),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("User is not the service user");
    }
  });

  it("allows matching Discord account users and rejects other account users", async () => {
    const allowed = Effect.gen(function* () {
      const authorization = yield* AuthorizationService;
      yield* authorization.requireDiscordAccountId("discord-user-1");
    });

    await Effect.runPromise(
      runAuthorization(allowed, {
        user: makeUser(["account:discord:discord-user-1"]),
      }),
    );

    const denied = await Effect.runPromiseExit(
      runAuthorization(allowed, {
        user: makeUser(["account:discord:discord-user-2"]),
      }),
    );

    expect(Exit.isFailure(denied)).toBe(true);
  });

  it("resolves guild permissions before requiring guild permission", async () => {
    const { client, resolveTokenPermissions } = makeSheetApisClient(["monitor_guild:guild-1"]);

    await Effect.runPromise(
      runAuthorization(
        Effect.gen(function* () {
          const authorization = yield* AuthorizationService;
          yield* authorization.requireMonitorGuild("guild-1");
        }),
        {
          sheetApisClient: client,
        },
      ),
    );

    expect(resolveTokenPermissions).toHaveBeenCalledTimes(1);
    const [actualCall] = resolveTokenPermissions.mock.calls[0];
    expect(Redacted.value(actualCall.payload.token)).toBe("token-1");
    expect(actualCall.payload.guildId).toBe("guild-1");
  });

  it("caches guild permission resolution for the same token and guild", async () => {
    const { client, resolveTokenPermissions } = makeSheetApisClient(["member_guild:guild-1"]);

    await Effect.runPromise(
      runAuthorization(
        Effect.gen(function* () {
          const authorization = yield* AuthorizationService;
          yield* authorization.resolveCurrentGuildUser("guild-1");
          yield* authorization.resolveCurrentGuildUser("guild-1");
        }),
        {
          sheetApisClient: client,
        },
      ),
    );

    expect(resolveTokenPermissions).toHaveBeenCalledTimes(1);
  });

  it("maps guild permission lookup failures to Unauthorized", async () => {
    const sheetApisClient = {
      withServiceUser: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
      permissions: {
        resolveTokenPermissions: () => Effect.fail(new Error("lookup failed")),
      },
    } as never;

    const exit = await Effect.runPromiseExit(
      runAuthorization(
        Effect.gen(function* () {
          const authorization = yield* AuthorizationService;
          yield* authorization.resolveCurrentGuildUser("guild-1");
        }),
        { sheetApisClient },
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("Failed to resolve guild permissions");
      expect(Cause.pretty(exit.cause)).toContain(Unauthorized.name);
    }
  });
});
