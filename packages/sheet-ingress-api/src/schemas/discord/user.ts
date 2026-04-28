import { Schema } from "effect";

// Avatar Decoration Data Object
// https://docs.discord.com/developers/resources/user#avatar-decoration-data-object
export const DiscordAvatarDecorationData = Schema.Struct({
  // The avatar decoration hash
  asset: Schema.String,
  // ID of the avatar decoration's SKU
  sku_id: Schema.String,
});

// Nameplate Structure
// https://docs.discord.com/developers/resources/user#nameplate
const DiscordNameplate = Schema.Struct({
  // ID of the nameplate SKU
  sku_id: Schema.String,
  // Path to the nameplate asset
  asset: Schema.String,
  // The label of this nameplate (currently unused)
  label: Schema.String,
  // Background color of the nameplate
  palette: Schema.String,
});

// Collectibles Structure
// https://docs.discord.com/developers/resources/user#collectibles
const DiscordCollectibles = Schema.Struct({
  // Object mapping of nameplate data
  nameplate: Schema.optional(DiscordNameplate),
});

// User Primary Guild Structure
// https://docs.discord.com/developers/resources/user#user-primary-guild
export const DiscordUserPrimaryGuild = Schema.Struct({
  // The ID of the user's primary guild
  identity_guild_id: Schema.optional(Schema.NullOr(Schema.String)),
  // Whether the user is displaying the primary guild's server tag
  identity_enabled: Schema.optional(Schema.NullOr(Schema.Boolean)),
  // The text of the user's server tag (limited to 4 characters)
  tag: Schema.optional(Schema.NullOr(Schema.String)),
  // The server tag badge hash
  badge: Schema.optional(Schema.NullOr(Schema.String)),
});

// User schema aligned with Discord User Object
// https://docs.discord.com/developers/resources/user#user-object
// All optional fields use optional(NullOr) to handle both undefined (cache miss) and null (Discord null)
export const DiscordUser = Schema.Struct({
  // The user's ID
  id: Schema.String,
  // The user's username (not unique across the platform)
  username: Schema.String,
  // The user's Discord-tag
  discriminator: Schema.String,
  // The user's display name, if it is set. For bots, this is the application name
  global_name: Schema.optional(Schema.NullOr(Schema.String)),
  // The user's avatar hash
  avatar: Schema.optional(Schema.NullOr(Schema.String)),
  // Whether the user belongs to an OAuth2 application
  bot: Schema.optional(Schema.Boolean),
  // Whether the user is an Official Discord System user
  system: Schema.optional(Schema.Boolean),
  // Whether the user has two factor enabled on their account
  mfa_enabled: Schema.optional(Schema.Boolean),
  // The user's banner hash
  banner: Schema.optional(Schema.NullOr(Schema.String)),
  // The user's banner color encoded as an integer representation of hexadecimal color code
  accent_color: Schema.optional(Schema.NullOr(Schema.Number)),
  // The user's chosen language option
  locale: Schema.optional(Schema.String),
  // Whether the email on this account has been verified
  verified: Schema.optional(Schema.Boolean),
  // The user's email
  email: Schema.optional(Schema.NullOr(Schema.String)),
  // The flags on a user's account
  flags: Schema.optional(Schema.Number),
  // The type of Nitro subscription on a user's account
  premium_type: Schema.optional(Schema.Number),
  // The public flags on a user's account
  public_flags: Schema.optional(Schema.Number),
  // Data for the user's avatar decoration
  avatar_decoration_data: Schema.optional(Schema.NullOr(DiscordAvatarDecorationData)),
  // Data for the user's collectibles
  collectibles: Schema.optional(Schema.NullOr(DiscordCollectibles)),
  // The user's primary guild
  primary_guild: Schema.optional(Schema.NullOr(DiscordUserPrimaryGuild)),
});
