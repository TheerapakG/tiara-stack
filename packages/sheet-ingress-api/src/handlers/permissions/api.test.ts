import { describe, expect, it } from "vitest";
import { Redacted, Schema } from "effect";
import { RedactedStringFromJsonString } from "./api";

describe("RedactedStringFromJsonString", () => {
  it("decodes a JSON token string into a Redacted token", () => {
    const decoded = Schema.decodeUnknownSync(RedactedStringFromJsonString)("token-value");

    expect(Redacted.value(decoded)).toBe("token-value");
  });

  it("encodes a Redacted token back to a JSON string for typed clients", () => {
    const encoded = Schema.encodeUnknownSync(RedactedStringFromJsonString)(
      Redacted.make("token-value"),
    );

    expect(encoded).toBe("token-value");
  });
});
