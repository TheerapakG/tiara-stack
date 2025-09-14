import { Schema } from "effect";

export class GuildChannelConfig extends Schema.TaggedClass<GuildChannelConfig>()(
  "GuildChannelConfig",
  {
    id: Schema.Number,
    guildId: Schema.String,
    channelId: Schema.String,
    name: Schema.OptionFromNullishOr(Schema.String, undefined),
    running: Schema.Boolean,
    roleId: Schema.OptionFromNullishOr(Schema.String, undefined),
    checkinChannelId: Schema.OptionFromNullishOr(Schema.String, undefined),
    createdAt: Schema.DateFromSelf,
    updatedAt: Schema.DateFromSelf,
    deletedAt: Schema.OptionFromNullishOr(Schema.DateFromSelf, undefined),
  },
) {}
