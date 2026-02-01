import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageCheckinMember } from "./messageCheckinMember";

describe("MessageCheckinMember", () => {
  it("MessageCheckinMember generates json schema", () => {
    const schema = JSONSchema.make(MessageCheckinMember);
    expect(schema).toBeDefined();
  });
});
