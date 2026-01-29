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

export class TeamIsvSplitConfig extends Schema.TaggedClass<TeamIsvSplitConfig>()(
  "TeamIsvSplitConfig",
  {
    leadRange: Schema.String,
    backlineRange: Schema.String,
    talentRange: Schema.String,
  },
) {}

export class TeamIsvCombinedConfig extends Schema.TaggedClass<TeamIsvCombinedConfig>()(
  "TeamIsvCombinedConfig",
  {
    isvRange: Schema.String,
  },
) {}

export class TeamConfig extends Schema.TaggedClass<TeamConfig>()("TeamConfig", {
  name: Schema.OptionFromNullishOr(Schema.String, undefined),
  sheet: Schema.OptionFromNullishOr(Schema.String, undefined),
  playerNameRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  teamNameRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  isvConfig: Schema.OptionFromNullishOr(
    Schema.Union(TeamIsvSplitConfig, TeamIsvCombinedConfig),
    undefined,
  ),
  tagsConfig: Schema.OptionFromNullishOr(
    Schema.Union(TeamTagsConstantsConfig, TeamTagsRangesConfig),
    undefined,
  ),
}) {}
