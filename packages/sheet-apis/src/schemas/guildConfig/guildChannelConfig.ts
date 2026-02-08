import { Schema } from "effect";

export class GuildChannelConfig extends Schema.TaggedClass<GuildChannelConfig>()(
  "GuildChannelConfig",
  {
    guildId: Schema.String,
    channelId: Schema.String,
    name: Schema.OptionFromNullOr(Schema.String),
    running: Schema.OptionFromNullOr(Schema.Boolean),
    roleId: Schema.OptionFromNullOr(Schema.String),
    checkinChannelId: Schema.OptionFromNullOr(Schema.String),
    createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  },
) {}
