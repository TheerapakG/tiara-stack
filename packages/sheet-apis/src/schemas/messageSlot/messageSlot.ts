import { Schema } from "effect";

export class MessageSlot extends Schema.TaggedClass<MessageSlot>()("MessageSlot", {
  messageId: Schema.String,
  day: Schema.Number,
  createdAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  updatedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  deletedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
}) {}
