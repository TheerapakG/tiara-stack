import { Schema } from "effect";

export class MessageRoomOrder extends Schema.TaggedClass<MessageRoomOrder>()("MessageRoomOrder", {
  messageId: Schema.String,
  hour: Schema.Number,
  previousFills: Schema.Array(Schema.String),
  fills: Schema.Array(Schema.String),
  rank: Schema.Number,
  monitor: Schema.OptionFromNullOr(Schema.String),
  createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
}) {}
