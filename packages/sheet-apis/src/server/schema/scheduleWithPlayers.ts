import { Array, Number, Option, Order, pipe, Schema } from "effect";
import { Player } from "./player";
import { PartialNamePlayer } from "./partialNamePlayer";

export class ScheduleWithPlayers extends Schema.TaggedClass<ScheduleWithPlayers>()(
  "ScheduleWithPlayers",
  {
    hour: Schema.Number,
    breakHour: Schema.Boolean,
    fills: pipe(
      Schema.Array(
        Schema.OptionFromNullishOr(
          Schema.Union(Player, PartialNamePlayer),
          undefined,
        ),
      ),
      Schema.itemsCount(5),
    ),
    overfills: Schema.Array(Schema.Union(Player, PartialNamePlayer)),
    standbys: Schema.Array(Schema.Union(Player, PartialNamePlayer)),
  },
) {
  static makeEmpty = (hour: number, breakHour?: boolean) =>
    new ScheduleWithPlayers({
      hour,
      breakHour: breakHour ?? false,
      fills: Array.makeBy(5, () => Option.none()),
      overfills: [],
      standbys: [],
    });

  static empty = ({ fills, overfills }: ScheduleWithPlayers) =>
    Order.max(Number.Order)(
      5 - fills.filter(Option.isSome).length - overfills.length,
      0,
    );

  static toEmptyIfBreak = (schedule: ScheduleWithPlayers) =>
    schedule.breakHour
      ? ScheduleWithPlayers.makeEmpty(schedule.hour, schedule.breakHour)
      : schedule;
}
