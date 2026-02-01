import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { RangesConfig } from "./rangesConfig";

describe("RangesConfig", () => {
  it("RangesConfig generates json schema", () => {
    const schema = JSONSchema.make(RangesConfig);
    expect(schema).toBeDefined();
  });
});
