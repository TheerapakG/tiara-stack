import { Schema } from "effect";

export class MessageCheckin extends Schema.TaggedClass<MessageCheckin>()("MessageCheckin", {
  messageId: Schema.String,
  initialMessage: Schema.String,
  hour: Schema.Number,
  channelId: Schema.String,
  roleId: Schema.OptionFromNullishOr(Schema.String, undefined),
  createdAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  updatedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  deletedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
}) {}
