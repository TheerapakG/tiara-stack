import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { Player, PartialIdPlayer, PartialNamePlayer } from "./player";

describe("Player", () => {
  it("Player generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(Player);
    expect(schema).toBeDefined();
  });
});

describe("PartialIdPlayer", () => {
  it("PartialIdPlayer generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PartialIdPlayer);
    expect(schema).toBeDefined();
  });
});

describe("PartialNamePlayer", () => {
  it("PartialNamePlayer generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PartialNamePlayer);
    expect(schema).toBeDefined();
  });
});
