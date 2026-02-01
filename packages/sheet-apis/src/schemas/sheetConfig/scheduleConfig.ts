import { Schema } from "effect";

export class ScheduleConfig extends Schema.TaggedClass<ScheduleConfig>()("ScheduleConfig", {
  channel: Schema.OptionFromNullOr(Schema.String),
  day: Schema.OptionFromNullOr(Schema.Number),
  sheet: Schema.OptionFromNullOr(Schema.String),
  hourRange: Schema.OptionFromNullOr(Schema.String),
  breakRange: Schema.OptionFromNullOr(Schema.String),
  monitorRange: Schema.OptionFromNullOr(Schema.String),
  encType: Schema.OptionFromNullOr(Schema.String),
  fillRange: Schema.OptionFromNullOr(Schema.String),
  overfillRange: Schema.OptionFromNullOr(Schema.String),
  standbyRange: Schema.OptionFromNullOr(Schema.String),
  screenshotRange: Schema.OptionFromNullOr(Schema.String),
  visibleCell: Schema.OptionFromNullOr(Schema.String),
  draft: Schema.OptionFromNullOr(Schema.String),
}) {}
