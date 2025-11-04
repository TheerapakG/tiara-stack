import { Array, Match, Number, Option, Order, pipe, Schema } from "effect";
import { Player } from "./player";
import { PartialNamePlayer } from "./partialNamePlayer";

export class EmptyScheduleWithPlayers extends Schema.TaggedClass<EmptyScheduleWithPlayers>()(
  "EmptyScheduleWithPlayers",
  {
    hour: Schema.OptionFromNullishOr(Schema.Number, undefined),
    breakHour: Schema.Boolean,
  },
) {}

export class ScheduleWithPlayers extends Schema.TaggedClass<ScheduleWithPlayers>()(
  "ScheduleWithPlayers",
  {
    channel: Schema.String,
    day: Schema.Number,
    hour: Schema.OptionFromNullishOr(Schema.Number, undefined),
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
  static makeEmpty = (hour: Option.Option<number>, breakHour?: boolean) =>
    new EmptyScheduleWithPlayers({
      hour,
      breakHour: breakHour ?? false,
    });

  static toEmptyIfBreak = (schedule: ScheduleWithPlayers) =>
    schedule.breakHour
      ? ScheduleWithPlayers.makeEmpty(schedule.hour, schedule.breakHour)
      : schedule;

  static getFills = (
    schedule: ScheduleWithPlayers | EmptyScheduleWithPlayers,
  ) =>
    pipe(
      Match.value(schedule),
      Match.tagsExhaustive({
        ScheduleWithPlayers: (schedule) => schedule.fills,
        EmptyScheduleWithPlayers: () =>
          Array.makeBy(5, () => Option.none<Player | PartialNamePlayer>()),
      }),
    );

  static getOverfills = (
    schedule: ScheduleWithPlayers | EmptyScheduleWithPlayers,
  ) =>
    pipe(
      Match.value(schedule),
      Match.tagsExhaustive({
        ScheduleWithPlayers: (schedule) => schedule.overfills,
        EmptyScheduleWithPlayers: () => [] as (Player | PartialNamePlayer)[],
      }),
    );

  static getStandbys = (
    schedule: ScheduleWithPlayers | EmptyScheduleWithPlayers,
  ) =>
    pipe(
      Match.value(schedule),
      Match.tagsExhaustive({
        ScheduleWithPlayers: (schedule) => schedule.standbys,
        EmptyScheduleWithPlayers: () => [] as (Player | PartialNamePlayer)[],
      }),
    );

  static empty = (schedule: ScheduleWithPlayers | EmptyScheduleWithPlayers) =>
    pipe(
      Match.value(schedule),
      Match.tagsExhaustive({
        ScheduleWithPlayers: ({ fills, overfills }) =>
          Order.max(Number.Order)(
            5 - fills.filter(Option.isSome).length - overfills.length,
            0,
          ),
        EmptyScheduleWithPlayers: () => 0,
      }),
    );
}
