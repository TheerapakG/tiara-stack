import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageRoomOrder } from "./messageRoomOrder";

describe("MessageRoomOrder", () => {
  it("MessageRoomOrder generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(MessageRoomOrder);
    expect(schema).toBeDefined();
  });
});
