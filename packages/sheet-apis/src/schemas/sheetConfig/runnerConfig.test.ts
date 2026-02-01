import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { RunnerConfig } from "./runnerConfig";

describe("RunnerConfig", () => {
  it("RunnerConfig generates json schema", () => {
    const schema = JSONSchema.make(RunnerConfig);
    expect(schema).toBeDefined();
  });
});
