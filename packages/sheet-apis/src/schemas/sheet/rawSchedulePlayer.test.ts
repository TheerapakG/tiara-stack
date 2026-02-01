import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { RawSchedulePlayer } from "./rawSchedulePlayer";

describe("RawSchedulePlayer", () => {
  it("RawSchedulePlayer generates json schema", () => {
    const schema = JSONSchema.make(RawSchedulePlayer);
    expect(schema).toBeDefined();
  });
});
