import { Schema } from "effect";

export class CheckinGenerateResult extends Schema.TaggedClass<CheckinGenerateResult>()(
  "CheckinGenerateResult",
  {
    hour: Schema.Number,
    runningChannelId: Schema.String,
    checkinChannelId: Schema.String,
    fillCount: Schema.Number,
    roleId: Schema.NullOr(Schema.String),
    initialMessage: Schema.NullOr(Schema.String),
    monitorCheckinMessage: Schema.String,
    monitorUserId: Schema.NullOr(Schema.String),
    monitorFailureMessage: Schema.NullOr(Schema.String),
    fillIds: Schema.Array(Schema.String),
  },
) {}
