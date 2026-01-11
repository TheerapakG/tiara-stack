import { Schema } from "effect";

export class PartialIdPlayer extends Schema.TaggedClass<PartialIdPlayer>()("PartialIdPlayer", {
  id: Schema.String,
}) {}
