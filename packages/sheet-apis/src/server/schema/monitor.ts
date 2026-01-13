import { Schema } from "effect";

export class Monitor extends Schema.TaggedClass<Monitor>()("Monitor", {
  index: Schema.Number,
  id: Schema.String,
  name: Schema.String,
}) {}
