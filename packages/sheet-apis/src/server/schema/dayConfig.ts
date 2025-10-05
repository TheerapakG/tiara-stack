import { Schema } from "effect";

export class DayConfig extends Schema.TaggedClass<DayConfig>()("DayConfig", {
  channel: Schema.String,
  day: Schema.Number,
  sheet: Schema.String,
  hourRange: Schema.String,
  breakRange: Schema.String,
  monitorRange: Schema.String,
  fillRange: Schema.String,
  overfillRange: Schema.String,
  standbyRange: Schema.String,
  draft: Schema.String,
}) {}
