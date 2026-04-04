import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import {
  PopulatedSchedulePlayer,
  PopulatedScheduleMonitor,
  PopulatedSchedule,
  PopulatedBreakSchedule,
} from "./populatedSchedule";

describe("PopulatedSchedulePlayer", () => {
  it("PopulatedSchedulePlayer generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PopulatedSchedulePlayer);
    expect(schema).toBeDefined();
  });
});

describe("PopulatedScheduleMonitor", () => {
  it("PopulatedScheduleMonitor generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PopulatedScheduleMonitor);
    expect(schema).toBeDefined();
  });
});

describe("PopulatedSchedule", () => {
  it("PopulatedSchedule generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PopulatedSchedule);
    expect(schema).toBeDefined();
  });
});

describe("PopulatedBreakSchedule", () => {
  it("PopulatedBreakSchedule generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PopulatedBreakSchedule);
    expect(schema).toBeDefined();
  });
});
