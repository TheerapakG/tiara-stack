import { HttpServerRequest } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Redacted } from "effect";
import type { Permission } from "@/schemas/permissions";
import { SheetAuthTokenAuthorization } from "../sheetAuthTokenAuthorization/tag";
import { makeSheetAuthTokenGuildMonitorAuthorization } from "./shared";

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
    const effect = authorization.sheetAuthToken(Redacted.make("token-1"));
    return yield* typeof guildId === "string"
      ? effect.pipe(Effect.provideService(HttpServerRequest.ParsedSearchParams, { guildId }))
      : effect;
  });

describe("SheetAuthTokenGuildMonitorAuthorizationLive", () => {
  it("allows monitor permission", () =>
    Effect.gen(function* () {
      const result = yield* authorize(["monitor_guild:guild-1"], "guild-1");
      expect(result.permissions).toEqual(["monitor_guild:guild-1"]);
    }));

  it("rejects a monitor permission for a different guild", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(authorize(["monitor_guild:guild-1"], "guild-2"));

      expect(exit._tag).toBe("Failure");
    }));

  it("rejects bot identity without monitor permission", () =>
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
    }));

  it("rejects when no monitor permission is present", () =>
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
    }));

  it("rejects when no guildId is present in the request", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(authorize(["monitor_guild:guild-1"]));

      expect(exit._tag).toBe("Failure");
    }));
});
