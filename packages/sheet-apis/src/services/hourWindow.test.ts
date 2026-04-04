import { describe, expect, it } from "@effect/vitest";
import { DateTime, Option } from "effect";
import { deriveScheduleHourWindow } from "./hourWindow";

describe("deriveScheduleHourWindow", () => {
  const startTime = DateTime.makeUnsafe("2026-03-26T12:00:00.000Z");

  it("returns none when the schedule hour is missing", () => {
    expect(deriveScheduleHourWindow(startTime, Option.none())).toEqual(Option.none());
  });

  it("derives the first hour window from the event start time", () => {
    expect(deriveScheduleHourWindow(startTime, Option.some(1))).toEqual(
      Option.some({
        _tag: "ScheduleHourWindow",
        start: startTime,
        end: DateTime.makeUnsafe("2026-03-26T13:00:00.000Z"),
      }),
    );
  });

  it("derives later hour windows relative to the event start time", () => {
    expect(deriveScheduleHourWindow(startTime, Option.some(4))).toEqual(
      Option.some({
        _tag: "ScheduleHourWindow",
        start: DateTime.makeUnsafe("2026-03-26T15:00:00.000Z"),
        end: DateTime.makeUnsafe("2026-03-26T16:00:00.000Z"),
      }),
    );
  });
});
