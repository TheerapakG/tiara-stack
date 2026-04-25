import { Schema } from "effect";

export class GuildConfig extends Schema.TaggedClass<GuildConfig>()("GuildConfig", {
  guildId: Schema.String,
  sheetId: Schema.OptionFromNullOr(Schema.String),
  autoCheckin: Schema.OptionFromNullOr(Schema.Boolean),
  createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
}) {}
