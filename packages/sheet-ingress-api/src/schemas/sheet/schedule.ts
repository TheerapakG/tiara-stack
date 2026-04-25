import { Match, Number, Option, Order, pipe, Schema } from "effect";
import { RawSchedulePlayer } from "./rawSchedulePlayer";
import { ScheduleHourWindow } from "./hourWindow";

const ScheduleFills = Schema.Array(Schema.OptionFromNullOr(RawSchedulePlayer)).check(
  Schema.isLengthBetween(5, 5),
);

export class BreakSchedule extends Schema.TaggedClass<BreakSchedule>()("BreakSchedule", {
  channel: Schema.String,
  day: Schema.Number,
  visible: Schema.Boolean,
  hour: Schema.OptionFromNullOr(Schema.Number),
  hourWindow: Schema.OptionFromNullOr(ScheduleHourWindow),
}) {}

export class Schedule extends Schema.TaggedClass<Schedule>()("Schedule", {
  channel: Schema.String,
  day: Schema.Number,
  visible: Schema.Boolean,
  hour: Schema.OptionFromNullOr(Schema.Number),
  hourWindow: Schema.OptionFromNullOr(ScheduleHourWindow),
  fills: ScheduleFills,
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
  hourWindow = Option.none(),
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
  hourWindow?: Option.Option<ScheduleHourWindow>;
  breakHour: boolean;
  fills: readonly Option.Option<RawSchedulePlayer>[];
  overfills: readonly RawSchedulePlayer[];
  standbys: readonly RawSchedulePlayer[];
  runners: readonly RawSchedulePlayer[];
  monitor: Option.Option<string>;
}) =>
  pipe(
    Match.value(breakHour),
    Match.when(
      true,
      () =>
        new BreakSchedule({
          channel,
          day,
          visible,
          hour,
          hourWindow,
        }),
    ),
    Match.when(
      false,
      () =>
        new Schedule({
          channel,
          day,
          visible,
          hour,
          hourWindow,
          fills,
          overfills,
          standbys,
          runners,
          monitor,
        }),
    ),
    Match.exhaustive,
  );
