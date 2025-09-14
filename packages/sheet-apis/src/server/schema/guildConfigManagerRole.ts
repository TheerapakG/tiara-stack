import { Schema } from "effect";

export class GuildConfigManagerRole extends Schema.TaggedClass<GuildConfigManagerRole>()(
  "GuildConfigManagerRole",
  {
    id: Schema.Number,
    guildId: Schema.String,
    roleId: Schema.String,
    createdAt: Schema.DateFromSelf,
    updatedAt: Schema.DateFromSelf,
    deletedAt: Schema.OptionFromNullishOr(Schema.DateFromSelf, undefined),
  },
) {}
