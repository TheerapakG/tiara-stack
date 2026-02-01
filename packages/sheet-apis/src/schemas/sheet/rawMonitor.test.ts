import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { RawMonitor } from "./rawMonitor";

describe("RawMonitor", () => {
  it("RawMonitor generates json schema", () => {
    const schema = JSONSchema.make(RawMonitor);
    expect(schema).toBeDefined();
  });
});
