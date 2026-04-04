import { Schema } from "effect";

export const DiscordAvatarDecorationData = Schema.Struct({
  asset: Schema.String,
  sku_id: Schema.NullOr(Schema.String),
});

export const DiscordUserNameplatePalette = Schema.String;

export const DiscordUserNameplate = Schema.Struct({
  sku_id: Schema.NullOr(Schema.String),
  asset: Schema.String,
  label: Schema.String,
  palette: DiscordUserNameplatePalette,
});

export const DiscordUserCollectibles = Schema.Struct({
  nameplate: Schema.NullOr(DiscordUserNameplate),
});

export const DiscordUserPrimaryGuild = Schema.Struct({
  identity_guild_id: Schema.NullOr(Schema.String),
  identity_enabled: Schema.NullOr(Schema.Boolean),
  tag: Schema.NullOr(Schema.String),
  badge: Schema.NullOr(Schema.String),
});

export const DiscordUser = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  avatar: Schema.NullOr(Schema.String),
  discriminator: Schema.String,
  public_flags: Schema.Number,
  flags: Schema.Number,
  bot: Schema.optional(Schema.Boolean),
  system: Schema.optional(Schema.Boolean),
  banner: Schema.optional(Schema.NullOr(Schema.String)),
  accent_color: Schema.optional(Schema.NullOr(Schema.Number)),
  global_name: Schema.NullOr(Schema.String),
  avatar_decoration_data: Schema.optional(Schema.NullOr(DiscordAvatarDecorationData)),
  collectibles: Schema.optional(Schema.NullOr(DiscordUserCollectibles)),
  primary_guild: Schema.NullOr(DiscordUserPrimaryGuild),
});

export type DiscordUser = typeof DiscordUser.Type;
