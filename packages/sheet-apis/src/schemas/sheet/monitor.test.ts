import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { Monitor, PartialIdMonitor, PartialNameMonitor } from "./monitor";

describe("Monitor", () => {
  it("Monitor generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(Monitor);
    expect(schema).toBeDefined();
  });
});

describe("PartialIdMonitor", () => {
  it("PartialIdMonitor generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PartialIdMonitor);
    expect(schema).toBeDefined();
  });
});

describe("PartialNameMonitor", () => {
  it("PartialNameMonitor generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PartialNameMonitor);
    expect(schema).toBeDefined();
  });
});
