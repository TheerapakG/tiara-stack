import { Schema } from "effect";

export class Player extends Schema.TaggedClass<Player>()("Player", {
  id: Schema.String,
  idIndex: Schema.Number,
  name: Schema.String,
  nameIndex: Schema.Number,
}) {}
