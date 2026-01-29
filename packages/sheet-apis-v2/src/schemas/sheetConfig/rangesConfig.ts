import { Schema } from "effect";

export class RangesConfig extends Schema.TaggedClass<RangesConfig>()("RangesConfig", {
  userIds: Schema.String,
  userSheetNames: Schema.String,
  userNotes: Schema.OptionFromNullishOr(Schema.String, undefined),
  monitorIds: Schema.OptionFromNullishOr(Schema.String, undefined),
  monitorNames: Schema.OptionFromNullishOr(Schema.String, undefined),
}) {}
