import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { ScheduleConfig } from "./scheduleConfig";

describe("ScheduleConfig", () => {
  it("ScheduleConfig generates json schema", () => {
    const schema = JSONSchema.make(ScheduleConfig);
    expect(schema).toBeDefined();
  });
});
