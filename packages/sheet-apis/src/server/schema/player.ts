import { Schema } from "effect";

export class Player extends Schema.TaggedClass<Player>()("Player", {
  index: Schema.Number,
  id: Schema.String,
  name: Schema.String,
}) {}
