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
    createdAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
    updatedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
    deletedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  },
) {}
