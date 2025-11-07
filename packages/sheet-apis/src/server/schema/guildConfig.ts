import { Schema } from "effect";

export class GuildConfig extends Schema.TaggedClass<GuildConfig>()(
  "GuildConfig",
  {
    id: Schema.Number,
    guildId: Schema.String,
    scriptId: Schema.OptionFromNullishOr(Schema.String, undefined),
    sheetId: Schema.OptionFromNullishOr(Schema.String, undefined),
    autoCheckin: Schema.Boolean,
    createdAt: Schema.DateFromSelf,
    updatedAt: Schema.DateFromSelf,
    deletedAt: Schema.OptionFromNullishOr(Schema.DateFromSelf, undefined),
  },
) {}
