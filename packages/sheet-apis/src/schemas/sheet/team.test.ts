import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { Team } from "./team";

describe("Team", () => {
  it("Team generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(Team);
    expect(schema).toBeDefined();
  });
});
