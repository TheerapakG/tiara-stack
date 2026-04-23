import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  PartialNamePlayer,
  Player,
  PopulatedSchedule,
  PopulatedSchedulePlayer,
} from "@/schemas/sheet";
import { getScheduleFillCount, makeMonitorCheckinMessage } from "./checkin";

const makeResolvedFill = (id: string, name: string) =>
  new PopulatedSchedulePlayer({
    player: new Player({
      index: 0,
      id,
      name,
    }),
    enc: false,
  });

const makePartialFill = (name: string) =>
  new PopulatedSchedulePlayer({
    player: new PartialNamePlayer({ name }),
    enc: false,
  });

const makeSchedule = (fills: ReadonlyArray<PopulatedSchedulePlayer>) =>
  new PopulatedSchedule({
    channel: "room-1",
    day: 1,
    visible: true,
    hour: Option.some(1),
    hourWindow: Option.none(),
    fills: [0, 1, 2, 3, 4].map((index) =>
      index < fills.length ? Option.some(fills[index]!) : Option.none(),
    ),
    overfills: [],
    standbys: [],
    runners: [],
    monitor: Option.none(),
  });

describe("makeMonitorCheckinMessage", () => {
  it("shows the new no-change copy and empty slots for a partially filled row", () => {
    expect(
      makeMonitorCheckinMessage({
        initialMessage: null,
        empty: 2,
        emptySlotMessage: "+2 empty slots",
        playerChangesMessage: "Out: None\nStay: <@1> <@2>\nIn: <@3>",
        lookupFailedMessage: Option.none(),
      }),
    ).toBe("No check-in message sent, no new players to check in\n+2 empty slots");
  });

  it("uses singular empty slot wording in the no-change branch", () => {
    expect(
      makeMonitorCheckinMessage({
        initialMessage: null,
        empty: 1,
        emptySlotMessage: "+1 empty slot",
        playerChangesMessage: "Out: None\nStay: <@1> <@2> <@3>\nIn: <@4>",
        lookupFailedMessage: Option.none(),
      }),
    ).toBe("No check-in message sent, no new players to check in\n+1 empty slot");
  });

  it("omits empty slots in the no-change branch when the row is full", () => {
    expect(
      makeMonitorCheckinMessage({
        initialMessage: null,
        empty: 0,
        emptySlotMessage: "No empty slots",
        playerChangesMessage: "Out: None\nStay: <@1> <@2> <@3> <@4>\nIn: <@5>",
        lookupFailedMessage: Option.none(),
      }),
    ).toBe("No check-in message sent, no new players to check in");
  });

  it("omits empty slots in the no-change branch for the fully empty fallback case", () => {
    expect(
      makeMonitorCheckinMessage({
        initialMessage: null,
        empty: 5,
        emptySlotMessage: "+5 empty slots",
        playerChangesMessage: "Out: None\nStay: None\nIn: None",
        lookupFailedMessage: Option.none(),
      }),
    ).toBe("No check-in message sent, no new players to check in");
  });

  it("keeps the sent-message branch unchanged", () => {
    expect(
      makeMonitorCheckinMessage({
        initialMessage: "hello",
        empty: 2,
        emptySlotMessage: "+2 empty slots",
        playerChangesMessage: "Out: <@1>\nStay: <@2>\nIn: <@3>",
        lookupFailedMessage: Option.some("Cannot look up Discord ID for Alice."),
      }),
    ).toBe(
      "Check-in message sent!\n+2 empty slots\nOut: <@1>\nStay: <@2>\nIn: <@3>\nCannot look up Discord ID for Alice.",
    );
  });

  it("renders empty movement buckets as None when they have no players", () => {
    expect(
      makeMonitorCheckinMessage({
        initialMessage: "hello",
        empty: 2,
        emptySlotMessage: "+2 empty slots",
        playerChangesMessage: "Out: None\nStay: <@1> <@2>\nIn: None",
        lookupFailedMessage: Option.none(),
      }),
    ).toBe("Check-in message sent!\n+2 empty slots\nOut: None\nStay: <@1> <@2>\nIn: None");
  });
});

describe("getScheduleFillCount", () => {
  it("counts all standard fills in the target hour", () => {
    const schedule = makeSchedule([
      makeResolvedFill("1", "Alice"),
      makeResolvedFill("2", "Bob"),
      makeResolvedFill("3", "Carol"),
      makeResolvedFill("4", "Dave"),
      makeResolvedFill("5", "Eve"),
    ]);

    expect(getScheduleFillCount(Option.some(schedule))).toBe(5);
  });

  it("counts both resolved and partial-name fills toward the threshold", () => {
    const schedule = makeSchedule([
      makeResolvedFill("1", "Alice"),
      makeResolvedFill("2", "Bob"),
      makePartialFill("Carol"),
      makePartialFill("Dave"),
    ]);

    expect(getScheduleFillCount(Option.some(schedule))).toBe(4);
  });
});
