import { Schema } from "effect";

export class TeamTagsConstantsConfig extends Schema.TaggedClass<TeamTagsConstantsConfig>()(
  "TeamTagsConstantsConfig",
  {
    tags: Schema.Array(Schema.String),
  },
) {}

export class TeamTagsRangesConfig extends Schema.TaggedClass<TeamTagsRangesConfig>()(
  "TeamTagsRangesConfig",
  {
    tagsRange: Schema.String,
  },
) {}

export class TeamConfig extends Schema.TaggedClass<TeamConfig>()("TeamConfig", {
  name: Schema.OptionFromNullishOr(Schema.String, undefined),
  sheet: Schema.OptionFromNullishOr(Schema.String, undefined),
  playerNameRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  teamNameRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  // ISV configuration: either split (3 columns) or combined (1 column)
  isvType: Schema.OptionFromNullishOr(
    Schema.Literal("split", "combined"),
    undefined,
  ),
  // When split: comma-separated ranges (lead, backline, optional talent)
  // When combined: single range of consolidated values like "150/750/364k"
  isvRanges: Schema.OptionFromNullishOr(Schema.String, undefined),
  tagsConfig: Schema.OptionFromNullishOr(
    Schema.Union(TeamTagsConstantsConfig, TeamTagsRangesConfig),
    undefined,
  ),
}) {}
