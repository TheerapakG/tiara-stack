import { Schema } from "effect";

export class RawMonitor extends Schema.TaggedClass<RawMonitor>()("RawMonitor", {
  index: Schema.Number,
  id: Schema.OptionFromNullishOr(Schema.String, undefined),
  name: Schema.OptionFromNullishOr(Schema.String, undefined),
}) {}
