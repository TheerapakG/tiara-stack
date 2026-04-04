import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { EventConfig } from "./eventConfig";

describe("EventConfig", () => {
  it("EventConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(EventConfig);
    expect(schema).toBeDefined();
  });
});
