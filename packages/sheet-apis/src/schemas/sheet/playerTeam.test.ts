import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { PlayerTeam } from "./playerTeam";

describe("PlayerTeam", () => {
  it("PlayerTeam generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PlayerTeam);
    expect(schema).toBeDefined();
  });
});
