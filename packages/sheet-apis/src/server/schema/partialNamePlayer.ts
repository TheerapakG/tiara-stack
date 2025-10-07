import { Schema } from "effect";

export class PartialNamePlayer extends Schema.TaggedClass<PartialNamePlayer>()(
  "PartialNamePlayer",
  {
    name: Schema.String,
  },
) {}
