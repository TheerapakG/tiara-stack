import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { Unauthorized } from "./unauthorized";

describe("Unauthorized", () => {
  it("uses the Unauthorized tag", () => {
    const error = new Unauthorized({ message: "nope" });

    expect(error._tag).toBe("Unauthorized");
    expect(error.message).toBe("nope");
  });

  it("preserves the cause", () => {
    const cause = new Error("denied");
    const error = new Unauthorized({ message: "nope", cause });

    expect(error.cause).toBe(cause);
  });

  it.effect(
    "decodes the optional cause",
    Effect.fnUntraced(function* () {
      const cause = { reason: "denied" };
      const decoded = yield* Schema.decodeUnknownEffect(Unauthorized)({
        _tag: "Unauthorized",
        message: "nope",
        cause,
      });

      expect(decoded).toBeInstanceOf(Unauthorized);
      expect(decoded.message).toBe("nope");
      expect(decoded.cause).toEqual(cause);
    }),
  );
});
