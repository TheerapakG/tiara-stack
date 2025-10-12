import { Schema } from "effect";

export class MessageCheckinMember extends Schema.TaggedClass<MessageCheckinMember>()(
  "MessageCheckinMember",
  {
    id: Schema.Number,
    messageId: Schema.String,
    memberId: Schema.String,
    checkinAt: Schema.OptionFromNullishOr(
      Schema.DateTimeUtcFromDate,
      undefined,
    ),
    createdAt: Schema.DateTimeUtcFromDate,
    updatedAt: Schema.DateTimeUtcFromDate,
    deletedAt: Schema.OptionFromNullishOr(
      Schema.DateTimeUtcFromDate,
      undefined,
    ),
  },
) {}
