import { Schema } from "effect";
import { DateTimeUtcFromUnknown } from "./dateSchemas";

export class MessageCheckin extends Schema.TaggedClass<MessageCheckin>()("MessageCheckin", {
  messageId: Schema.String,
  initialMessage: Schema.String,
  hour: Schema.Number,
  channelId: Schema.String,
  roleId: Schema.OptionFromNullishOr(Schema.String, undefined),
  createdAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
  updatedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
  deletedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
}) {}
