import { Schema } from "effect";

export class MessageRoomOrderEntry extends Schema.TaggedClass<MessageRoomOrderEntry>()(
  "MessageRoomOrderEntry",
  {
    messageId: Schema.String,
    rank: Schema.Number,
    position: Schema.Number,
    team: Schema.String,
    tags: Schema.Array(Schema.String),
    effectValue: Schema.Number,
    createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  },
) {}
