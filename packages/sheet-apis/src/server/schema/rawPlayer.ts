import { Schema } from "effect";

export class RawPlayer extends Schema.TaggedClass<RawPlayer>()("RawPlayer", {
  id: Schema.OptionFromNullishOr(Schema.String, undefined),
  idIndex: Schema.Number,
  name: Schema.OptionFromNullishOr(Schema.String, undefined),
  nameIndex: Schema.Number,
}) {}
