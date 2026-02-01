import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageCheckin } from "./messageCheckin";

describe("MessageCheckin", () => {
  it("MessageCheckin generates json schema", () => {
    const schema = JSONSchema.make(MessageCheckin);
    expect(schema).toBeDefined();
  });
});
