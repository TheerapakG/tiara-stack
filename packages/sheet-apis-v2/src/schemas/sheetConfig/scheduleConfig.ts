import { Schema } from "effect";

export class ScheduleConfig extends Schema.TaggedClass<ScheduleConfig>()("ScheduleConfig", {
  channel: Schema.OptionFromNullishOr(Schema.String, undefined),
  day: Schema.OptionFromNullishOr(Schema.Number, undefined),
  sheet: Schema.OptionFromNullishOr(Schema.String, undefined),
  hourRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  breakRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  monitorRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  encType: Schema.OptionFromNullishOr(Schema.String, undefined),
  fillRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  overfillRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  standbyRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  screenshotRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  visibleCell: Schema.OptionFromNullishOr(Schema.String, undefined),
  draft: Schema.OptionFromNullishOr(Schema.String, undefined),
}) {}
