import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { MessageRoomOrderEntry } from "./messageRoomOrderEntry";

describe("MessageRoomOrderEntry", () => {
  it("MessageRoomOrderEntry generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(MessageRoomOrderEntry);
    expect(schema).toBeDefined();
  });
});
