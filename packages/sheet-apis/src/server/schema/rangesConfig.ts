import { Schema } from "effect";

export class RangesConfig extends Schema.TaggedClass<RangesConfig>()(
  "RangesConfig",
  {
    userIds: Schema.String,
    userSheetNames: Schema.String,
    hours: Schema.String,
    breaks: Schema.String,
    fills: Schema.String,
    overfills: Schema.String,
    standbys: Schema.String,
  },
) {}
