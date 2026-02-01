import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import {
  PopulatedSchedulePlayer,
  PopulatedScheduleMonitor,
  PopulatedSchedule,
  PopulatedBreakSchedule,
} from "./populatedSchedule";

describe("PopulatedSchedulePlayer", () => {
  it("PopulatedSchedulePlayer generates json schema", () => {
    const schema = JSONSchema.make(PopulatedSchedulePlayer);
    expect(schema).toBeDefined();
  });
});

describe("PopulatedScheduleMonitor", () => {
  it("PopulatedScheduleMonitor generates json schema", () => {
    const schema = JSONSchema.make(PopulatedScheduleMonitor);
    expect(schema).toBeDefined();
  });
});

describe("PopulatedSchedule", () => {
  it("PopulatedSchedule generates json schema", () => {
    const schema = JSONSchema.make(PopulatedSchedule);
    expect(schema).toBeDefined();
  });
});

describe("PopulatedBreakSchedule", () => {
  it("PopulatedBreakSchedule generates json schema", () => {
    const schema = JSONSchema.make(PopulatedBreakSchedule);
    expect(schema).toBeDefined();
  });
});
