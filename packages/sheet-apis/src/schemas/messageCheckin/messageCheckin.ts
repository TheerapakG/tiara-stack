import { Schema } from "effect";

export class MessageCheckin extends Schema.TaggedClass<MessageCheckin>()("MessageCheckin", {
  messageId: Schema.String,
  initialMessage: Schema.String,
  hour: Schema.Number,
  channelId: Schema.String,
  roleId: Schema.OptionFromNullOr(Schema.String),
  guildId: Schema.OptionFromNullOr(Schema.String),
  messageChannelId: Schema.OptionFromNullOr(Schema.String),
  createdByUserId: Schema.OptionFromNullOr(Schema.String),
  createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
}) {}
