import { HttpRouter, HttpServerRequest } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Redacted } from "effect";
import type { Permission } from "@/schemas/permissions";
import { SheetAuthTokenAuthorization } from "../sheetAuthTokenAuthorization/tag";
import { makeSheetAuthTokenGuildMonitorAuthorization } from "./shared";

const routeContext = {
  params: {},
  route: {},
} as unknown as HttpRouter.RouteContext;

const provideRequestContext = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  guildId?: string,
): Effect.Effect<A, E> =>
  effect.pipe(
    Effect.provideService(
      HttpServerRequest.ParsedSearchParams,
      typeof guildId === "string" ? { guildId } : {},
    ),
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(new Request("http://localhost/test", { method: "GET" })),
    ),
    Effect.provideService(HttpRouter.RouteContext, routeContext),
  ) as Effect.Effect<A, E>;

const authorize = (permissions: Permission[], guildId?: string) =>
  Effect.gen(function* () {
    const authorization = yield* makeSheetAuthTokenGuildMonitorAuthorization(
      SheetAuthTokenAuthorization.of({
        sheetAuthToken: (token) =>
          Effect.succeed({
            accountId: "account-1",
            userId: "user-1",
            permissions,
            token,
          }),
      }),
    );
    return yield* provideRequestContext(
      authorization.sheetAuthToken(Redacted.make("token-1")),
      guildId,
    );
  });

describe("SheetAuthTokenGuildMonitorAuthorizationLive", () => {
  it.effect("allows monitor permission", () =>
    Effect.gen(function* () {
      const result = yield* authorize(["monitor_guild:guild-1"], "guild-1");
      expect(result.permissions).toEqual(["monitor_guild:guild-1"]);
    }),
  );

  it.effect("rejects a monitor permission for a different guild", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(authorize(["monitor_guild:guild-1"], "guild-2"));

      expect(exit._tag).toBe("Failure");
    }),
  );

  it.effect("rejects bot identity without monitor permission", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(authorize(["bot"], "guild-1"));

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
        if (failure._tag === "Some") {
          expect((failure.value as { message: string }).message).toContain(
            "User is not a guild monitor",
          );
        }
      }
    }),
  );

  it.effect("rejects when no monitor permission is present", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(authorize([], "guild-1"));

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const failure = Cause.failureOption(exit.cause);
        expect(failure._tag).toBe("Some");
        if (failure._tag === "Some") {
          expect((failure.value as { message: string }).message).toContain(
            "User is not a guild monitor",
          );
        }
      }
    }),
  );

  it.effect("rejects when no guildId is present in the request", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(authorize(["monitor_guild:guild-1"]));

      expect(exit._tag).toBe("Failure");
    }),
  );
});
