import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { HourRange } from "./hourRange";

describe("HourRange", () => {
  it("HourRange generates json schema", () => {
    const schema = JSONSchema.make(HourRange);
    expect(schema).toBeDefined();
  });
});
