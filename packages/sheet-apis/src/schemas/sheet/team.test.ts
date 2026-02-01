import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { Team } from "./team";

describe("Team", () => {
  it("Team generates json schema", () => {
    const schema = JSONSchema.make(Team);
    expect(schema).toBeDefined();
  });
});
