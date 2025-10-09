import { Array, Number, Option, Order, pipe, Schema } from "effect";

export class ScheduleIndex extends Schema.TaggedClass<ScheduleIndex>()(
  "ScheduleIndex",
  {
    channel: Schema.String,
    day: Schema.Number,
  },
) {}

export class Schedule extends Schema.TaggedClass<Schedule>()("Schedule", {
  hour: Schema.Number,
  breakHour: Schema.Boolean,
  fills: pipe(
    Schema.Array(Schema.OptionFromNullishOr(Schema.String, undefined)),
    Schema.itemsCount(5),
  ),
  overfills: Schema.Array(Schema.String),
  standbys: Schema.Array(Schema.String),
}) {
  static makeEmpty = (hour: number, breakHour?: boolean) =>
    new Schedule({
      hour,
      breakHour: breakHour ?? false,
      fills: Array.makeBy(5, () => Option.none()),
      overfills: [],
      standbys: [],
    });

  static empty = ({ fills, overfills }: Schedule) =>
    Order.max(Number.Order)(
      5 - fills.filter(Option.isSome).length - overfills.length,
      0,
    );

  static toEmptyIfBreak = (schedule: Schedule) =>
    schedule.breakHour
      ? Schedule.makeEmpty(schedule.hour, schedule.breakHour)
      : schedule;
}
