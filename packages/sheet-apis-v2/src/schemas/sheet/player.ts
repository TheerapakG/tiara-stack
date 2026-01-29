import { Schema } from "effect";

export class Player extends Schema.TaggedClass<Player>()("Player", {
  index: Schema.Number,
  id: Schema.String,
  name: Schema.String,
}) {}

export class PartialIdPlayer extends Schema.TaggedClass<PartialIdPlayer>()("PartialIdPlayer", {
  id: Schema.String,
}) {}

export class PartialNamePlayer extends Schema.TaggedClass<PartialNamePlayer>()(
  "PartialNamePlayer",
  {
    name: Schema.String,
  },
) {}
