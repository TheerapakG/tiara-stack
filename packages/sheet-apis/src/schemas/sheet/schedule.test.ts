import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { Schedule, BreakSchedule } from "./schedule";
import { ScheduleHourWindow } from "./hourWindow";

describe("ScheduleHourWindow", () => {
  it("ScheduleHourWindow generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(ScheduleHourWindow);
    expect(schema).toBeDefined();
  });
});

describe("BreakSchedule", () => {
  it("BreakSchedule generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(BreakSchedule);
    expect(schema).toBeDefined();
  });
});

describe("Schedule", () => {
  it("Schedule generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(Schedule);
    expect(schema).toBeDefined();
  });
});
