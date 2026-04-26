import { describe, expect, it } from "vitest";
import { Redacted } from "effect";
import { decodeBearerCredential } from "./bearerCredential";

describe("decodeBearerCredential", () => {
  it("decodes percent-encoded bearer credentials before forwarding them to sheet-apis", () => {
    const credential = Redacted.make("abc.def%2Fghi%3D");

    expect(Redacted.value(decodeBearerCredential(credential))).toBe("abc.def/ghi=");
  });

  it("keeps malformed percent-encoded credentials unchanged", () => {
    const credential = Redacted.make("abc%");

    expect(decodeBearerCredential(credential)).toBe(credential);
  });
});
