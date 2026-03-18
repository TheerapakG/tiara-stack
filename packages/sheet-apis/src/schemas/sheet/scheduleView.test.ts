import { JSONSchema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import {
  ScheduleView,
  ScheduleResponse,
  PopulatedScheduleResponse,
  getEffectiveScheduleView,
  getMaximumScheduleView,
} from "./scheduleView";

describe("ScheduleView", () => {
  it("ScheduleView generates json schema", () => {
    const schema = JSONSchema.make(ScheduleView);
    expect(schema).toBeDefined();
  });
});

describe("ScheduleResponse", () => {
  it("ScheduleResponse generates json schema", () => {
    const schema = JSONSchema.make(ScheduleResponse);
    expect(schema).toBeDefined();
  });
});

describe("PopulatedScheduleResponse", () => {
  it("PopulatedScheduleResponse generates json schema", () => {
    const schema = JSONSchema.make(PopulatedScheduleResponse);
    expect(schema).toBeDefined();
  });
});

describe("getMaximumScheduleView", () => {
  it("returns monitor for monitor users", () => {
    expect(getMaximumScheduleView(["monitor_guild"])).toBe("monitor");
  });

  it("returns filler without monitor permission", () => {
    expect(getMaximumScheduleView(["manage_guild"])).toBe("filler");
  });
});

describe("getEffectiveScheduleView", () => {
  it("defaults to monitor when no view is requested", () => {
    expect(getEffectiveScheduleView("monitor")).toBe("monitor");
  });

  it("falls back to filler when the user lacks monitor permission", () => {
    expect(getEffectiveScheduleView("filler")).toBe("filler");
  });

  it("respects an explicit filler request for monitor users", () => {
    expect(getEffectiveScheduleView("monitor", "filler")).toBe("filler");
  });

  it("keeps filler when both max and requested views are filler", () => {
    expect(getEffectiveScheduleView("filler", "filler")).toBe("filler");
  });

  it("clamps filler user requesting monitor to filler", () => {
    expect(getEffectiveScheduleView("filler", "monitor")).toBe("filler");
  });
});
