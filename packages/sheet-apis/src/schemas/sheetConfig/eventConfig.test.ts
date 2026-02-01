import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { EventConfig } from "./eventConfig";

describe("EventConfig", () => {
  it("EventConfig generates json schema", () => {
    const schema = JSONSchema.make(EventConfig);
    expect(schema).toBeDefined();
  });
});
