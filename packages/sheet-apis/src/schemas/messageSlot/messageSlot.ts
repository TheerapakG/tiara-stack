import { Schema } from "effect";

export class MessageSlot extends Schema.TaggedClass<MessageSlot>()("MessageSlot", {
  messageId: Schema.String,
  day: Schema.Number,
  createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
}) {}
