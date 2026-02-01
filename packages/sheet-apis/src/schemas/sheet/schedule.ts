import { Match, Number, Option, Order, pipe, Schema } from "effect";
import { RawSchedulePlayer } from "./rawSchedulePlayer";

export class BreakSchedule extends Schema.TaggedClass<BreakSchedule>()("BreakSchedule", {
  channel: Schema.String,
  day: Schema.Number,
  visible: Schema.Boolean,
  hour: Schema.OptionFromNullOr(Schema.Number),
}) {}

export class Schedule extends Schema.TaggedClass<Schedule>()("Schedule", {
  channel: Schema.String,
  day: Schema.Number,
  visible: Schema.Boolean,
  hour: Schema.OptionFromNullOr(Schema.Number),
  fills: pipe(Schema.Array(Schema.OptionFromNullOr(RawSchedulePlayer)), Schema.itemsCount(5)),
  overfills: Schema.Array(RawSchedulePlayer),
  standbys: Schema.Array(RawSchedulePlayer),
  runners: Schema.Array(RawSchedulePlayer),
  monitor: Schema.OptionFromNullOr(Schema.String),
}) {
  static empty = ({ fills, overfills }: Schedule) =>
    Order.max(Number.Order)(5 - fills.filter(Option.isSome).length - overfills.length, 0);
}

export const makeSchedule = ({
  channel,
  day,
  visible,
  hour,
  breakHour,
  fills,
  overfills,
  standbys,
  runners,
  monitor,
}: {
  channel: string;
  day: number;
  visible: boolean;
  hour: Option.Option<number>;
  breakHour: boolean;
  fills: readonly Option.Option<RawSchedulePlayer>[];
  overfills: readonly RawSchedulePlayer[];
  standbys: readonly RawSchedulePlayer[];
  runners: readonly RawSchedulePlayer[];
  monitor: Option.Option<string>;
}) =>
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
      Schedule.make({
        channel,
        day,
        visible,
        hour,
        fills,
        overfills,
        standbys,
        runners,
        monitor,
      }),
    ),
    Match.exhaustive,
  );
