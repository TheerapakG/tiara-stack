import { Schema } from "effect";
import { DateFromUnknown } from "./dateSchemas";

export class GuildConfigManagerRole extends Schema.TaggedClass<GuildConfigManagerRole>()(
  "GuildConfigManagerRole",
  {
    guildId: Schema.String,
    roleId: Schema.String,
    createdAt: Schema.OptionFromNullishOr(DateFromUnknown, undefined),
    updatedAt: Schema.OptionFromNullishOr(DateFromUnknown, undefined),
    deletedAt: Schema.OptionFromNullishOr(DateFromUnknown, undefined),
  },
) {}
