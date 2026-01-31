import { Schema } from "effect";

export class MessageCheckinMember extends Schema.TaggedClass<MessageCheckinMember>()(
  "MessageCheckinMember",
  {
    messageId: Schema.String,
    memberId: Schema.String,
    checkinAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
    createdAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
    updatedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
    deletedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  },
) {}
