import { Schema } from "effect";

export class MessageRoomOrder extends Schema.TaggedClass<MessageRoomOrder>()("MessageRoomOrder", {
  messageId: Schema.String,
  hour: Schema.Number,
  previousFills: Schema.Array(Schema.String),
  fills: Schema.Array(Schema.String),
  rank: Schema.Number,
  monitor: Schema.OptionFromNullishOr(Schema.String, undefined),
  createdAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  updatedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  deletedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
}) {}
