import { Match, Number, Option, Order, pipe, Schema } from "effect";

export class BreakSchedule extends Schema.TaggedClass<BreakSchedule>()(
  "BreakSchedule",
  {
    channel: Schema.String,
    day: Schema.Number,
    visible: Schema.Boolean,
    hour: Schema.OptionFromNullishOr(Schema.Number, undefined),
  },
) {}

export class Schedule extends Schema.TaggedClass<Schedule>()("Schedule", {
  channel: Schema.String,
  day: Schema.Number,
  visible: Schema.Boolean,
  hour: Schema.OptionFromNullishOr(Schema.Number, undefined),
  fills: pipe(
    Schema.Array(Schema.OptionFromNullishOr(Schema.String, undefined)),
    Schema.itemsCount(5),
  ),
  overfills: Schema.Array(Schema.String),
  standbys: Schema.Array(Schema.String),
}) {
  static empty = ({ fills, overfills }: Schedule) =>
    Order.max(Number.Order)(
      5 - fills.filter(Option.isSome).length - overfills.length,
      0,
    );
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
}: {
  channel: string;
  day: number;
  visible: boolean;
  hour: Option.Option<number>;
  breakHour: boolean;
  fills: readonly Option.Option<string>[];
  overfills: readonly string[];
  standbys: readonly string[];
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
      }),
    ),
    Match.exhaustive,
  );
