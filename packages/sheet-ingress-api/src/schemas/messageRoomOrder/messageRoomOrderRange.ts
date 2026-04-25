import { Schema } from "effect";

export class MessageRoomOrderRange extends Schema.TaggedClass<MessageRoomOrderRange>()(
  "MessageRoomOrderRange",
  {
    minRank: Schema.Number,
    maxRank: Schema.Number,
  },
) {}
