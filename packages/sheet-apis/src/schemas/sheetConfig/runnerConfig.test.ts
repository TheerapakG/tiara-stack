import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { RunnerConfig } from "./runnerConfig";

describe("RunnerConfig", () => {
  it("RunnerConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(RunnerConfig);
    expect(schema).toBeDefined();
  });
});
