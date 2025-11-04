import { Array, Match, Number, Option, Order, pipe, Schema } from "effect";

export class EmptySchedule extends Schema.TaggedClass<EmptySchedule>()(
  "EmptySchedule",
  {
    hour: Schema.OptionFromNullishOr(Schema.Number, undefined),
    breakHour: Schema.Boolean,
  },
) {}

export class Schedule extends Schema.TaggedClass<Schedule>()("Schedule", {
  channel: Schema.String,
  day: Schema.Number,
  hour: Schema.OptionFromNullishOr(Schema.Number, undefined),
  breakHour: Schema.Boolean,
  fills: pipe(
    Schema.Array(Schema.OptionFromNullishOr(Schema.String, undefined)),
    Schema.itemsCount(5),
  ),
  overfills: Schema.Array(Schema.String),
  standbys: Schema.Array(Schema.String),
}) {
  static makeEmpty = (hour: Option.Option<number>, breakHour?: boolean) =>
    new EmptySchedule({
      hour,
      breakHour: breakHour ?? false,
    });

  static toEmptyIfBreak = (schedule: Schedule) =>
    schedule.breakHour
      ? Schedule.makeEmpty(schedule.hour, schedule.breakHour)
      : schedule;

  static getFills = (schedule: Schedule | EmptySchedule) =>
    pipe(
      Match.value(schedule),
      Match.tagsExhaustive({
        Schedule: (schedule) => schedule.fills,
        EmptySchedule: () => Array.makeBy(5, () => Option.none<string>()),
      }),
    );

  static getOverfills = (schedule: Schedule | EmptySchedule) =>
    pipe(
      Match.value(schedule),
      Match.tagsExhaustive({
        Schedule: (schedule) => schedule.overfills,
        EmptySchedule: () => [] as string[],
      }),
    );

  static getStandbys = (schedule: Schedule | EmptySchedule) =>
    pipe(
      Match.value(schedule),
      Match.tagsExhaustive({
        Schedule: (schedule) => schedule.standbys,
        EmptySchedule: () => [] as string[],
      }),
    );

  static empty = (schedule: Schedule | EmptySchedule) =>
    pipe(
      Match.value(schedule),
      Match.tagsExhaustive({
        Schedule: ({ fills, overfills }) =>
          Order.max(Number.Order)(
            5 - fills.filter(Option.isSome).length - overfills.length,
            0,
          ),
        EmptySchedule: () => 0,
      }),
    );
}
