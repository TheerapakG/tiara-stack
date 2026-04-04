import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageCheckin } from "./messageCheckin";

describe("MessageCheckin", () => {
  it("MessageCheckin generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(MessageCheckin);
    expect(schema).toBeDefined();
  });
});
