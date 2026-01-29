import { Schema } from "effect";
import { DateFromUnknown } from "../date";

export class GuildChannelConfig extends Schema.TaggedClass<GuildChannelConfig>()(
  "GuildChannelConfig",
  {
    guildId: Schema.String,
    channelId: Schema.String,
    name: Schema.OptionFromNullishOr(Schema.String, undefined),
    running: Schema.Boolean,
    roleId: Schema.OptionFromNullishOr(Schema.String, undefined),
    checkinChannelId: Schema.OptionFromNullishOr(Schema.String, undefined),
    createdAt: Schema.OptionFromNullishOr(DateFromUnknown, undefined),
    updatedAt: Schema.OptionFromNullishOr(DateFromUnknown, undefined),
    deletedAt: Schema.OptionFromNullishOr(DateFromUnknown, undefined),
  },
) {}
