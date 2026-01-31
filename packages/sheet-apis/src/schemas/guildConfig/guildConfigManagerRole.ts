import { Schema } from "effect";

export class GuildConfigManagerRole extends Schema.TaggedClass<GuildConfigManagerRole>()(
  "GuildConfigManagerRole",
  {
    guildId: Schema.String,
    roleId: Schema.String,
    createdAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
    updatedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
    deletedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  },
) {}
