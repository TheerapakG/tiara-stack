import { Schema } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { permissionSetFromIterable } from "@/middlewares/authorization";
import {
  ScheduleView,
  ScheduleResponse,
  PopulatedScheduleResponse,
  PlayerDayScheduleSummary,
  PlayerDayScheduleResponse,
  getEffectiveScheduleView,
  getMaximumScheduleView,
} from "./scheduleView";

describe("ScheduleView", () => {
  it("ScheduleView generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(ScheduleView);
    expect(schema).toBeDefined();
  });
});

describe("ScheduleResponse", () => {
  it("ScheduleResponse generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(ScheduleResponse);
    expect(schema).toBeDefined();
  });
});

describe("PopulatedScheduleResponse", () => {
  it("PopulatedScheduleResponse generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PopulatedScheduleResponse);
    expect(schema).toBeDefined();
  });
});

describe("PlayerDayScheduleSummary", () => {
  it("PlayerDayScheduleSummary generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PlayerDayScheduleSummary);
    expect(schema).toBeDefined();
  });
});

describe("PlayerDayScheduleResponse", () => {
  it("PlayerDayScheduleResponse generates json schema", () => {
    const schema = Schema.toJsonSchemaDocument(PlayerDayScheduleResponse);
    expect(schema).toBeDefined();
  });
});

describe("getMaximumScheduleView", () => {
  it("returns monitor for bot users", () => {
    expect(getMaximumScheduleView(permissionSetFromIterable(["bot"]), "guild-1")).toBe("monitor");
  });

  it("returns monitor for app owners", () => {
    expect(getMaximumScheduleView(permissionSetFromIterable(["app_owner"]), "guild-1")).toBe(
      "monitor",
    );
  });

  it("returns monitor for monitor users", () => {
    expect(
      getMaximumScheduleView(permissionSetFromIterable(["monitor_guild:guild-1"]), "guild-1"),
    ).toBe("monitor");
  });

  it("returns filler without monitor permission", () => {
    expect(
      getMaximumScheduleView(permissionSetFromIterable(["manage_guild:guild-1"]), "guild-1"),
    ).toBe("filler");
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
