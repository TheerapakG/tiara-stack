import { Schema } from "effect";

export class RawSchedulePlayer extends Schema.TaggedClass<RawSchedulePlayer>()(
  "RawSchedulePlayer",
  {
    player: Schema.String,
    enc: Schema.Boolean,
  },
) {}
