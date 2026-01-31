import { Schema } from "effect";
import { DateTimeUtcFromUnknown } from "../date";

export class MessageRoomOrderEntry extends Schema.TaggedClass<MessageRoomOrderEntry>()(
  "MessageRoomOrderEntry",
  {
    messageId: Schema.String,
    rank: Schema.Number,
    position: Schema.Number,
    team: Schema.String,
    tags: Schema.Array(Schema.String),
    effectValue: Schema.Number,
    createdAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
    updatedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
    deletedAt: Schema.OptionFromNullishOr(DateTimeUtcFromUnknown, undefined),
  },
) {}
