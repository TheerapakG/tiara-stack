import { Schema } from "effect";

export class GuildConfigManagerRole extends Schema.TaggedClass<GuildConfigManagerRole>()(
  "GuildConfigManagerRole",
  {
    guildId: Schema.String,
    roleId: Schema.String,
    createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  },
) {}
