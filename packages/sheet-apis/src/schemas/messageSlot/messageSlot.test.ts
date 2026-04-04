import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageSlot } from "./messageSlot";

describe("MessageSlot", () => {
  it("MessageSlot generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(MessageSlot);
    expect(schema).toBeDefined();
  });
});
