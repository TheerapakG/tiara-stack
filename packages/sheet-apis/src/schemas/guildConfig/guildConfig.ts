import { Schema } from "effect";

export class GuildConfig extends Schema.TaggedClass<GuildConfig>()("GuildConfig", {
  guildId: Schema.String,
  scriptId: Schema.OptionFromNullOr(Schema.String),
  sheetId: Schema.OptionFromNullOr(Schema.String),
  autoCheckin: Schema.Boolean,
  createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
}) {}
