import { Schema } from "effect";
import { DateTimeUtcFromUnknown } from "../date";

export class MessageCheckinMember extends Schema.TaggedClass<MessageCheckinMember>()(
  "MessageCheckinMember",
  {
    messageId: Schema.String,
    memberId: Schema.String,
    checkinAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
    createdAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
    updatedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
    deletedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
  },
) {}
