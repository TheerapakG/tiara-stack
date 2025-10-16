import { Schema } from "effect";

export class ScheduleConfig extends Schema.TaggedClass<ScheduleConfig>()(
  "ScheduleConfig",
  {
    channel: Schema.String,
    day: Schema.Number,
    sheet: Schema.String,
    hourRange: Schema.String,
    breakRange: Schema.String,
    monitorRange: Schema.String,
    fillRange: Schema.String,
    overfillRange: Schema.String,
    standbyRange: Schema.String,
    draft: Schema.OptionFromNullishOr(Schema.String, undefined),
  },
) {}
