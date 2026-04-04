import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { Room } from "./room";

describe("Room", () => {
  it("Room generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(Room);
    expect(schema).toBeDefined();
  });
});
