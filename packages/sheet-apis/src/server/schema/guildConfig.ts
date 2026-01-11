import { Schema } from "effect";
import { DateFromUnknown } from "./dateSchemas";

export class GuildConfig extends Schema.TaggedClass<GuildConfig>()("GuildConfig", {
  id: Schema.Number,
  guildId: Schema.String,
  scriptId: Schema.OptionFromNullishOr(Schema.String, undefined),
  sheetId: Schema.OptionFromNullishOr(Schema.String, undefined),
  autoCheckin: Schema.Boolean,
  createdAt: Schema.OptionFromNullishOr(DateFromUnknown, undefined),
  updatedAt: Schema.OptionFromNullishOr(DateFromUnknown, undefined),
  deletedAt: Schema.OptionFromNullishOr(DateFromUnknown, undefined),
}) {}
