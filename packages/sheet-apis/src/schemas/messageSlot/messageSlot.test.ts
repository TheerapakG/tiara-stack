import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageSlot } from "./messageSlot";

describe("MessageSlot", () => {
  it("MessageSlot generates json schema", () => {
    const schema = JSONSchema.make(MessageSlot);
    expect(schema).toBeDefined();
  });
});
