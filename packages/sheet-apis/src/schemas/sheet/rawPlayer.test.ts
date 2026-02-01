import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { RawPlayer } from "./rawPlayer";

describe("RawPlayer", () => {
  it("RawPlayer generates json schema", () => {
    const schema = JSONSchema.make(RawPlayer);
    expect(schema).toBeDefined();
  });
});
