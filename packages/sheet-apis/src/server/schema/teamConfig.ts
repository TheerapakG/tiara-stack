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
  name: Schema.String,
  sheet: Schema.String,
  playerNameRange: Schema.String,
  teamNameRange: Schema.String,
  leadRange: Schema.String,
  backlineRange: Schema.String,
  talentRange: Schema.String,
  tagsConfig: Schema.Union(TeamTagsConstantsConfig, TeamTagsRangesConfig),
}) {}
