import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { RangesConfig } from "./rangesConfig";

describe("RangesConfig", () => {
  it("RangesConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(RangesConfig);
    expect(schema).toBeDefined();
  });
});
