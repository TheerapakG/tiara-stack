import { Schema } from "effect";

export const DiscordAvatarDecorationData = Schema.Struct({
  asset: Schema.String,
  sku_id: Schema.optional(Schema.NullOr(Schema.String)),
});

export const DiscordUser = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  avatar: Schema.optional(Schema.NullOr(Schema.String)),
  discriminator: Schema.String,
  public_flags: Schema.Number,
  flags: Schema.Number,
  bot: Schema.optional(Schema.Boolean),
  system: Schema.optional(Schema.Boolean),
  banner: Schema.optional(Schema.NullOr(Schema.String)),
  accent_color: Schema.optional(Schema.NullOr(Schema.Number)),
  global_name: Schema.optional(Schema.NullOr(Schema.String)),
  avatar_decoration_data: Schema.optional(Schema.NullOr(DiscordAvatarDecorationData)),
});

export type DiscordUser = typeof DiscordUser.Type;
