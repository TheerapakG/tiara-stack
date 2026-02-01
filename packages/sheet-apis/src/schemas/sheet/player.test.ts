import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { Player, PartialIdPlayer, PartialNamePlayer } from "./player";

describe("Player", () => {
  it("Player generates json schema", () => {
    const schema = JSONSchema.make(Player);
    expect(schema).toBeDefined();
  });
});

describe("PartialIdPlayer", () => {
  it("PartialIdPlayer generates json schema", () => {
    const schema = JSONSchema.make(PartialIdPlayer);
    expect(schema).toBeDefined();
  });
});

describe("PartialNamePlayer", () => {
  it("PartialNamePlayer generates json schema", () => {
    const schema = JSONSchema.make(PartialNamePlayer);
    expect(schema).toBeDefined();
  });
});
