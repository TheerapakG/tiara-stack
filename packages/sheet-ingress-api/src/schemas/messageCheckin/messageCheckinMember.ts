import { Schema } from "effect";

export class MessageCheckinMember extends Schema.TaggedClass<MessageCheckinMember>()(
  "MessageCheckinMember",
  {
    messageId: Schema.String,
    memberId: Schema.String,
    checkinAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    checkinClaimId: Schema.OptionFromNullOr(Schema.String),
    createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  },
) {}
