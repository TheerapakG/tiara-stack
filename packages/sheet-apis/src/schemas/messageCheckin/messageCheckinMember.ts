import { Schema } from "effect";

export class MessageCheckinMember extends Schema.TaggedClass<MessageCheckinMember>()(
  "MessageCheckinMember",
  {
    messageId: Schema.String,
    memberId: Schema.String,
    checkinAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  },
) {}
