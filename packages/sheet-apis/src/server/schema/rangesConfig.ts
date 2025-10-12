import { Schema } from "effect";

export class RangesConfig extends Schema.TaggedClass<RangesConfig>()(
  "RangesConfig",
  {
    userIds: Schema.String,
    userSheetNames: Schema.String,
  },
) {}
