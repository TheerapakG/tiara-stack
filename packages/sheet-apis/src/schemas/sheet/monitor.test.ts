import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { Monitor, PartialIdMonitor, PartialNameMonitor } from "./monitor";

describe("Monitor", () => {
  it("Monitor generates json schema", () => {
    const schema = JSONSchema.make(Monitor);
    expect(schema).toBeDefined();
  });
});

describe("PartialIdMonitor", () => {
  it("PartialIdMonitor generates json schema", () => {
    const schema = JSONSchema.make(PartialIdMonitor);
    expect(schema).toBeDefined();
  });
});

describe("PartialNameMonitor", () => {
  it("PartialNameMonitor generates json schema", () => {
    const schema = JSONSchema.make(PartialNameMonitor);
    expect(schema).toBeDefined();
  });
});
