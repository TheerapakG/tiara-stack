import { Schema } from "effect";

export class GuildChannelConfig extends Schema.TaggedClass<GuildChannelConfig>()(
  "GuildChannelConfig",
  {
    guildId: Schema.String,
    channelId: Schema.String,
    name: Schema.OptionFromNullishOr(Schema.String, undefined),
    running: Schema.Boolean,
    roleId: Schema.OptionFromNullishOr(Schema.String, undefined),
    checkinChannelId: Schema.OptionFromNullishOr(Schema.String, undefined),
    createdAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
    updatedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
    deletedAt: Schema.OptionFromNullishOr(Schema.DateTimeUtcFromNumber, undefined),
  },
) {}
