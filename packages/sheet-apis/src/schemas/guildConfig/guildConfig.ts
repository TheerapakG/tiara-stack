import { Schema } from "effect";

export class GuildConfig extends Schema.TaggedClass<GuildConfig>()("GuildConfig", {
  guildId: Schema.String,
  scriptId: Schema.OptionFromNullishOr(Schema.String, undefined),
  sheetId: Schema.OptionFromNullishOr(Schema.String, undefined),
  autoCheckin: Schema.Boolean,
  createdAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  updatedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  deletedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
}) {}
