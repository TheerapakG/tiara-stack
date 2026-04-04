import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { HourRange } from "./hourRange";

describe("HourRange", () => {
  it("HourRange generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(HourRange);
    expect(schema).toBeDefined();
  });
});
