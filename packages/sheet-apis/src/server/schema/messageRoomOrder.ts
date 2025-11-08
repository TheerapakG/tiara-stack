import { Schema } from "effect";

export class MessageRoomOrder extends Schema.TaggedClass<MessageRoomOrder>()(
  "MessageRoomOrder",
  {
    id: Schema.Number,
    messageId: Schema.String,
    hour: Schema.Number,
    previousFills: Schema.Array(Schema.String),
    fills: Schema.Array(Schema.String),
    rank: Schema.Number,
    createdAt: Schema.DateTimeUtcFromDate,
    updatedAt: Schema.DateTimeUtcFromDate,
    deletedAt: Schema.OptionFromNullishOr(
      Schema.DateTimeUtcFromDate,
      undefined,
    ),
  },
) {}
