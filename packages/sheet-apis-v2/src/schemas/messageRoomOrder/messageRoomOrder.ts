import { Schema } from "effect";
import { DateTimeUtcFromUnknown } from "../date";

export class MessageRoomOrder extends Schema.TaggedClass<MessageRoomOrder>()("MessageRoomOrder", {
  messageId: Schema.String,
  hour: Schema.Number,
  previousFills: Schema.Array(Schema.String),
  fills: Schema.Array(Schema.String),
  rank: Schema.Number,
  monitor: Schema.OptionFromNullishOr(Schema.String, undefined),
  createdAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
  updatedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
  deletedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
}) {}
