import { Schema } from "effect";

export class MessageCheckin extends Schema.TaggedClass<MessageCheckin>()(
  "MessageCheckin",
  {
    id: Schema.Number,
    messageId: Schema.String,
    initialMessage: Schema.String,
    hour: Schema.Number,
    channelId: Schema.String,
    roleId: Schema.OptionFromNullishOr(Schema.String, undefined),
    createdAt: Schema.DateTimeUtcFromDate,
    updatedAt: Schema.DateTimeUtcFromDate,
    deletedAt: Schema.OptionFromNullishOr(
      Schema.DateTimeUtcFromDate,
      undefined,
    ),
  },
) {}
