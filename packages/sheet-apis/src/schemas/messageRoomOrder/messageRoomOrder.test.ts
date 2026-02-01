import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageRoomOrder } from "./messageRoomOrder";

describe("MessageRoomOrder", () => {
  it("MessageRoomOrder generates json schema", () => {
    const schema = JSONSchema.make(MessageRoomOrder);
    expect(schema).toBeDefined();
  });
});
