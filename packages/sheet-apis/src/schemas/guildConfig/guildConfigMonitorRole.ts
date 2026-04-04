import { Schema } from "effect";

export class GuildConfigMonitorRole extends Schema.TaggedClass<GuildConfigMonitorRole>()(
  "GuildConfigMonitorRole",
  {
    guildId: Schema.String,
    roleId: Schema.String,
    createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  },
) {}
