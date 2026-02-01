import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { PlayerTeam } from "./playerTeam";

describe("PlayerTeam", () => {
  it("PlayerTeam generates json schema", () => {
    const schema = JSONSchema.make(PlayerTeam);
    expect(schema).toBeDefined();
  });
});
