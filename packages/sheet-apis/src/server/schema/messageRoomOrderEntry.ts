import { Schema } from "effect";

export class MessageRoomOrderEntry extends Schema.TaggedClass<MessageRoomOrderEntry>()(
  "MessageRoomOrderEntry",
  {
    id: Schema.Number,
    messageId: Schema.String,
    rank: Schema.Number,
    position: Schema.Number,
    team: Schema.String,
    tags: Schema.Array(Schema.String),
    createdAt: Schema.DateTimeUtcFromDate,
    updatedAt: Schema.DateTimeUtcFromDate,
    deletedAt: Schema.OptionFromNullishOr(
      Schema.DateTimeUtcFromDate,
      undefined,
    ),
  },
) {}
