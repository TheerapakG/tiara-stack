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

export class IsvSplitConfig extends Schema.TaggedClass<IsvSplitConfig>()(
  "IsvSplitConfig",
  {
    leadRange: Schema.OptionFromNullishOr(Schema.String, undefined),
    backlineRange: Schema.OptionFromNullishOr(Schema.String, undefined),
    talentRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  },
) {}

export class IsvCombinedConfig extends Schema.TaggedClass<IsvCombinedConfig>()(
  "IsvCombinedConfig",
  {
    isvRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  },
) {}

export class TeamConfig extends Schema.TaggedClass<TeamConfig>()("TeamConfig", {
  name: Schema.OptionFromNullishOr(Schema.String, undefined),
  sheet: Schema.OptionFromNullishOr(Schema.String, undefined),
  playerNameRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  teamNameRange: Schema.OptionFromNullishOr(Schema.String, undefined),
  isvConfig: Schema.OptionFromNullishOr(
    Schema.Union(IsvSplitConfig, IsvCombinedConfig),
    undefined,
  ),
  tagsConfig: Schema.OptionFromNullishOr(
    Schema.Union(TeamTagsConstantsConfig, TeamTagsRangesConfig),
    undefined,
  ),
}) {}
