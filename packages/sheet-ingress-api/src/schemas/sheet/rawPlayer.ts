import { Schema } from "effect";

export class RawPlayer extends Schema.TaggedClass<RawPlayer>()("RawPlayer", {
  index: Schema.Number,
  id: Schema.OptionFromNullOr(Schema.String),
  name: Schema.OptionFromNullOr(Schema.String),
}) {}
