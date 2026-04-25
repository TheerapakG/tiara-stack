import { Schema } from "effect";

export class GeneratedRoomOrderEntry extends Schema.TaggedClass<GeneratedRoomOrderEntry>()(
  "GeneratedRoomOrderEntry",
  {
    rank: Schema.Number,
    position: Schema.Number,
    hour: Schema.Number,
    team: Schema.String,
    tags: Schema.Array(Schema.String),
    effectValue: Schema.Number,
  },
) {}
