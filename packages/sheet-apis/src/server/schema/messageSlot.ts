import { Schema } from "effect";
import { DateTimeUtcFromUnknown } from "./dateSchemas";

export class MessageSlot extends Schema.TaggedClass<MessageSlot>()("MessageSlot", {
  messageId: Schema.String,
  day: Schema.Number,
  createdAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
  updatedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
  deletedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
}) {}
