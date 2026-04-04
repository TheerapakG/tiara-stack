import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { RawPlayer } from "./rawPlayer";

describe("RawPlayer", () => {
  it("RawPlayer generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(RawPlayer);
    expect(schema).toBeDefined();
  });
});
