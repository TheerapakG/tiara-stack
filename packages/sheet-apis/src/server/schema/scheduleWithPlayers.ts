import { Match, Number, Option, Order, pipe, Schema } from "effect";
import { Player } from "./player";
import { PartialNamePlayer } from "./partialNamePlayer";
import { BreakSchedule } from "./schedule";

export class ScheduleWithPlayers extends Schema.TaggedClass<ScheduleWithPlayers>()(
  "ScheduleWithPlayers",
  {
    channel: Schema.String,
    day: Schema.Number,
    visible: Schema.Boolean,
    hour: Schema.OptionFromNullishOr(Schema.Number, undefined),
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
  static empty = ({ fills, overfills }: ScheduleWithPlayers) =>
    Order.max(Number.Order)(
      5 - fills.filter(Option.isSome).length - overfills.length,
      0,
    );
}

export const makeScheduleWithPlayers = (
  channel: string,
  day: number,
  visible: boolean,
  hour: Option.Option<number>,
  breakHour: boolean,
  fills: readonly Option.Option<Player | PartialNamePlayer>[],
  overfills: readonly (Player | PartialNamePlayer)[],
  standbys: readonly (Player | PartialNamePlayer)[],
) =>
  pipe(
    Match.value(breakHour),
    Match.when(true, () =>
      BreakSchedule.make({
        channel,
        day,
        visible,
        hour,
      }),
    ),
    Match.when(false, () =>
      ScheduleWithPlayers.make({
        channel,
        day,
        visible,
        hour,
        fills,
        overfills,
        standbys,
      }),
    ),
    Match.exhaustive,
  );
