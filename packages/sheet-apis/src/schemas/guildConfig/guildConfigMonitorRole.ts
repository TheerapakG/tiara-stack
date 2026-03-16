import { Schema } from "effect";

export class GuildConfigMonitorRole extends Schema.TaggedClass<GuildConfigMonitorRole>()(
  "GuildConfigMonitorRole",
  {
    guildId: Schema.String,
    roleId: Schema.String,
    createdAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    updatedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
    deletedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromNumber),
  },
) {}
