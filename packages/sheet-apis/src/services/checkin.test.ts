import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { makeMonitorCheckinMessage } from "./checkin";

describe("makeMonitorCheckinMessage", () => {
  it("shows the new no-change copy and empty slots for a partially filled row", () => {
    expect(
      makeMonitorCheckinMessage({
        initialMessage: null,
        empty: 2,
        emptySlotMessage: "+2 empty slots",
        playersMessage: "Players: <@1> <@2> <@3>",
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
        playersMessage: "Players: <@1> <@2> <@3> <@4>",
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
        playersMessage: "Players: <@1> <@2> <@3> <@4> <@5>",
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
        playersMessage: "Players: ",
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
        playersMessage: "Players: <@1> <@2> <@3>",
        lookupFailedMessage: Option.some("Cannot look up Discord ID for Alice."),
      }),
    ).toBe(
      "Check-in message sent!\n+2 empty slots\nPlayers: <@1> <@2> <@3>\nCannot look up Discord ID for Alice.",
    );
  });

  it("omits lookup-failed message in sent-message branch when none", () => {
    expect(
      makeMonitorCheckinMessage({
        initialMessage: "hello",
        empty: 2,
        emptySlotMessage: "+2 empty slots",
        playersMessage: "Players: <@1> <@2> <@3>",
        lookupFailedMessage: Option.none(),
      }),
    ).toBe("Check-in message sent!\n+2 empty slots\nPlayers: <@1> <@2> <@3>");
  });
});
