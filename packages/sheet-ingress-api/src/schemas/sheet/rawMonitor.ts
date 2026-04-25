import { Schema } from "effect";

export class RawMonitor extends Schema.TaggedClass<RawMonitor>()("RawMonitor", {
  index: Schema.Number,
  id: Schema.OptionFromNullOr(Schema.String),
  name: Schema.OptionFromNullOr(Schema.String),
}) {}
