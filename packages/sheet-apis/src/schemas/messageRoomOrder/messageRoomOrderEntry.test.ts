import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageRoomOrderEntry } from "./messageRoomOrderEntry";

describe("MessageRoomOrderEntry", () => {
  it("MessageRoomOrderEntry generates json schema", () => {
    const schema = JSONSchema.make(MessageRoomOrderEntry);
    expect(schema).toBeDefined();
  });
});
