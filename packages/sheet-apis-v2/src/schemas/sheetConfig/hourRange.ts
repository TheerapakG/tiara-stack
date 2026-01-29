import { Schema } from "effect";

export class HourRange extends Schema.TaggedClass<HourRange>()("HourRange", {
  start: Schema.Number,
  end: Schema.Number,
}) {
  static includes = (hour: number) => (hourRange: HourRange) =>
    hour >= hourRange.start && hour <= hourRange.end;
}
