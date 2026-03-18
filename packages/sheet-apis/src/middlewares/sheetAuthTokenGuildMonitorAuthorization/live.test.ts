import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Redacted } from "effect";
import type { Permission } from "sheet-auth/plugins/kubernetes-oauth/client";
import { SheetAuthTokenAuthorization } from "../sheetAuthTokenAuthorization/tag";
import { makeSheetAuthTokenGuildMonitorAuthorization } from "./shared";

const authorize = (permissions: Permission[]) =>
  Effect.gen(function* () {
    const authorization = yield* makeSheetAuthTokenGuildMonitorAuthorization(
      SheetAuthTokenAuthorization.of({
        sheetAuthToken: (token) =>
          Effect.succeed({
            userId: "user-1",
            permissions,
            token,
          }),
      }),
    );
    return yield* authorization.sheetAuthToken(Redacted.make("token-1"));
  });

describe("SheetAuthTokenGuildMonitorAuthorizationLive", () => {
  it("allows bot monitor permission", () =>
    Effect.gen(function* () {
      const result = yield* authorize(["bot:monitor_guild"]);
      expect(result.permissions).toEqual(["bot:monitor_guild"]);
    }));

  it("allows user monitor permission", () =>
    Effect.gen(function* () {
      const result = yield* authorize(["user:monitor_guild"]);
      expect(result.permissions).toEqual(["user:monitor_guild"]);
    }));

  it("rejects when no monitor permission is present", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(authorize([]));

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
});
