import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { Schedule, BreakSchedule } from "./schedule";
import { ScheduleHourWindow } from "./hourWindow";

describe("ScheduleHourWindow", () => {
  it("ScheduleHourWindow generates json schema", () => {
    const schema = JSONSchema.make(ScheduleHourWindow);
    expect(schema).toBeDefined();
  });
});

describe("BreakSchedule", () => {
  it("BreakSchedule generates json schema", () => {
    const schema = JSONSchema.make(BreakSchedule);
    expect(schema).toBeDefined();
  });
});

describe("Schedule", () => {
  it("Schedule generates json schema", () => {
    const schema = JSONSchema.make(Schedule);
    expect(schema).toBeDefined();
  });
});
