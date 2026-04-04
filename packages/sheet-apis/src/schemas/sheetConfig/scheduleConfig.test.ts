import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { ScheduleConfig } from "./scheduleConfig";

describe("ScheduleConfig", () => {
  it("ScheduleConfig generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(ScheduleConfig);
    expect(schema).toBeDefined();
  });
});
