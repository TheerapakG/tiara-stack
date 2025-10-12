import { Schema } from "effect";

export class MessageSlot extends Schema.TaggedClass<MessageSlot>()(
  "MessageSlot",
  {
    id: Schema.Number,
    messageId: Schema.String,
    day: Schema.Number,
    createdAt: Schema.DateTimeUtcFromDate,
    updatedAt: Schema.DateTimeUtcFromDate,
    deletedAt: Schema.OptionFromNullishOr(
      Schema.DateTimeUtcFromDate,
      undefined,
    ),
  },
) {}
