import { Schema } from "effect";

export class RawPlayer extends Schema.TaggedClass<RawPlayer>()("RawPlayer", {
  index: Schema.Number,
  id: Schema.OptionFromNullishOr(Schema.String, undefined),
  name: Schema.OptionFromNullishOr(Schema.String, undefined),
}) {}
