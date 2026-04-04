import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageCheckinMember } from "./messageCheckinMember";

describe("MessageCheckinMember", () => {
  it("MessageCheckinMember generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(MessageCheckinMember);
    expect(schema).toBeDefined();
  });
});
