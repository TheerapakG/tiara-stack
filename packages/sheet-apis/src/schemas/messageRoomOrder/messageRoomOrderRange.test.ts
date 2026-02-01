import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageRoomOrderRange } from "./messageRoomOrderRange";

describe("MessageRoomOrderRange", () => {
  it("MessageRoomOrderRange generates json schema", () => {
    const schema = JSONSchema.make(MessageRoomOrderRange);
    expect(schema).toBeDefined();
  });
});
