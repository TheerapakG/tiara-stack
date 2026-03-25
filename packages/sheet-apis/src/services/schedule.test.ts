import { describe, expect, it } from "@effect/vitest";
import { Array, Option } from "effect";
import {
  PartialNamePlayer,
  Player,
  PopulatedBreakSchedule,
  PopulatedSchedule,
  PopulatedSchedulePlayer,
} from "@/schemas/sheet";
import { summarizeDayPlayerSchedule } from "./schedule";

const makePlayer = (id: string, name = id) =>
  new Player({
    index: 0,
    id,
    name,
  });

const makeSchedulePlayer = (player: Player | PartialNamePlayer) =>
  new PopulatedSchedulePlayer({
    player,
    enc: false,
  });

const makeSchedule = ({
  hour,
  visible = true,
  fills = [],
  overfills = [],
  standbys = [],
}: {
  hour: number | null;
  visible?: boolean;
  fills?: ReadonlyArray<PopulatedSchedulePlayer>;
  overfills?: ReadonlyArray<PopulatedSchedulePlayer>;
  standbys?: ReadonlyArray<PopulatedSchedulePlayer>;
}) =>
  new PopulatedSchedule({
    channel: "main",
    day: 1,
    visible,
    hour: Option.fromNullable(hour),
    fills: Array.makeBy(5, (index) => Option.fromNullable(fills[index])),
    overfills,
    standbys,
    runners: [],
    monitor: Option.none(),
  });

describe("summarizeDayPlayerSchedule", () => {
  it("collects and sorts matching fill, overfill, and standby hours", () => {
    const player = makePlayer("player-1", "Alice");
    const schedules = [
      makeSchedule({ hour: 5, standbys: [makeSchedulePlayer(player)] }),
      makeSchedule({ hour: 3, fills: [makeSchedulePlayer(player)] }),
      makeSchedule({ hour: 4, overfills: [makeSchedulePlayer(player)] }),
      makeSchedule({ hour: 3, fills: [makeSchedulePlayer(player)] }),
    ];

    expect(summarizeDayPlayerSchedule(schedules, "player-1")).toEqual({
      fillHours: [3],
      overfillHours: [4],
      standbyHours: [5],
      invisible: false,
    });
  });

  it("ignores break schedules, partial-name players, and rows without an hour", () => {
    const schedules = [
      new PopulatedBreakSchedule({
        channel: "main",
        day: 1,
        visible: true,
        hour: Option.some(1),
      }),
      makeSchedule({
        hour: null,
        fills: [makeSchedulePlayer(makePlayer("player-1", "Alice"))],
      }),
      makeSchedule({
        hour: 2,
        fills: [makeSchedulePlayer(new PartialNamePlayer({ name: "Alice" }))],
      }),
    ];

    expect(summarizeDayPlayerSchedule(schedules, "player-1")).toEqual({
      fillHours: [],
      overfillHours: [],
      standbyHours: [],
      invisible: false,
    });
  });

  it("marks the day invisible when any schedule row is hidden", () => {
    const schedules = [
      makeSchedule({ hour: 1, visible: false }),
      makeSchedule({ hour: 2, fills: [makeSchedulePlayer(makePlayer("player-1"))] }),
    ];

    expect(summarizeDayPlayerSchedule(schedules, "player-1")).toEqual({
      fillHours: [2],
      overfillHours: [],
      standbyHours: [],
      invisible: true,
    });
  });
});
