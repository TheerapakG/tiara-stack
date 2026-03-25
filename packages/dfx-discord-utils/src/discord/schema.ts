import { HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";

// ============================================================================
// Discord Enums
// ============================================================================

// Video quality mode - known values with number fallback
export const VideoQualityMode = Schema.Union(Schema.Literal(1, 2), Schema.Number);
export type VideoQualityMode = typeof VideoQualityMode.Type;

// Thread auto archive duration - known values with number fallback
export const ThreadAutoArchiveDuration = Schema.Union(
  Schema.Literal(60, 1440, 4320, 10080),
  Schema.Number,
);
export type ThreadAutoArchiveDuration = typeof ThreadAutoArchiveDuration.Type;

// Forum layout: 0 = Default, 1 = List view, 2 = Gallery view
export const ForumLayout = Schema.Union(Schema.Literal(0, 1, 2), Schema.Number);
export type ForumLayout = typeof ForumLayout.Type;

// Thread search tag setting - known values with string fallback
export const ThreadSearchTagSetting = Schema.Union(
  Schema.Literal("match_all", "match_some"),
  Schema.String,
);
export type ThreadSearchTagSetting = typeof ThreadSearchTagSetting.Type;

// Verification levels - known values with number fallback
export const VerificationLevels = Schema.Union(Schema.Literal(0, 1, 2, 3, 4), Schema.Number);
export type VerificationLevels = typeof VerificationLevels.Type;

// User notification settings - known values with number fallback
export const UserNotificationSettings = Schema.Union(Schema.Literal(0, 1), Schema.Number);
export type UserNotificationSettings = typeof UserNotificationSettings.Type;

// Guild MFA level - known values with number fallback
export const GuildMFALevel = Schema.Union(Schema.Literal(0, 1), Schema.Number);
export type GuildMFALevel = typeof GuildMFALevel.Type;

// Guild explicit content filter types - known values with number fallback
export const GuildExplicitContentFilterTypes = Schema.Union(Schema.Literal(0, 1, 2), Schema.Number);
export type GuildExplicitContentFilterTypes = typeof GuildExplicitContentFilterTypes.Type;

// Premium guild tiers - known values with number fallback
export const PremiumGuildTiers = Schema.Union(Schema.Literal(0, 1, 2, 3), Schema.Number);
export type PremiumGuildTiers = typeof PremiumGuildTiers.Type;

// Guild NSFW content level - known values with number fallback
export const GuildNSFWContentLevel = Schema.Union(Schema.Literal(0, 1, 2, 3), Schema.Number);
export type GuildNSFWContentLevel = typeof GuildNSFWContentLevel.Type;

// Sticker format types - known values with number fallback
export const StickerFormatTypes = Schema.Union(Schema.Literal(1, 2, 3, 4), Schema.Number);
export type StickerFormatTypes = typeof StickerFormatTypes.Type;

// Available locales
// Available locales - known literals with string fallback for future locales
// Discord actively adds new locale codes
export const AvailableLocalesEnum = Schema.Union(
  Schema.Literal("id"),
  Schema.Literal("da"),
  Schema.Literal("de"),
  Schema.Literal("en-GB"),
  Schema.Literal("en-US"),
  Schema.Literal("es-419"),
  Schema.Literal("es-ES"),
  Schema.Literal("fr"),
  Schema.Literal("hr"),
  Schema.Literal("it"),
  Schema.Literal("lt"),
  Schema.Literal("hu"),
  Schema.Literal("nl"),
  Schema.Literal("no"),
  Schema.Literal("pl"),
  Schema.Literal("pt-BR"),
  Schema.Literal("ro"),
  Schema.Literal("fi"),
  Schema.Literal("sv-SE"),
  Schema.Literal("vi"),
  Schema.Literal("tr"),
  Schema.Literal("cs"),
  Schema.Literal("el"),
  Schema.Literal("bg"),
  Schema.Literal("ru"),
  Schema.Literal("uk"),
  Schema.Literal("hi"),
  Schema.Literal("th"),
  Schema.Literal("zh-CN"),
  Schema.Literal("ja"),
  Schema.Literal("zh-TW"),
  Schema.Literal("ko"),
  Schema.Literal("ar"),
  Schema.Literal("he"),
  Schema.String, // fallback for unknown future locales
);
export type AvailableLocalesEnum = typeof AvailableLocalesEnum.Type;

// Guild features - known literals with string fallback for future features
// Discord regularly adds new guild feature flags
export const GuildFeature = Schema.Union(
  Schema.Literal("ANIMATED_BANNER"),
  Schema.Literal("ANIMATED_ICON"),
  Schema.Literal("APPLICATION_COMMAND_PERMISSIONS_V2"),
  Schema.Literal("AUTO_MODERATION"),
  Schema.Literal("BANNER"),
  Schema.Literal("COMMUNITY"),
  Schema.Literal("CREATOR_MONETIZABLE_PROVISIONAL"),
  Schema.Literal("CREATOR_STORE_PAGE"),
  Schema.Literal("DEVELOPER_SUPPORT_SERVER"),
  Schema.Literal("DISCOVERABLE"),
  Schema.Literal("FEATURABLE"),
  Schema.Literal("INVITES_DISABLED"),
  Schema.Literal("INVITE_SPLASH"),
  Schema.Literal("MEMBER_VERIFICATION_GATE_ENABLED"),
  Schema.Literal("MORE_STICKERS"),
  Schema.Literal("NEWS"),
  Schema.Literal("PARTNERED"),
  Schema.Literal("PREVIEW_ENABLED"),
  Schema.Literal("RAID_ALERTS_DISABLED"),
  Schema.Literal("ROLE_ICONS"),
  Schema.Literal("ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE"),
  Schema.Literal("ROLE_SUBSCRIPTIONS_ENABLED"),
  Schema.Literal("TICKETED_EVENTS_ENABLED"),
  Schema.Literal("VANITY_URL"),
  Schema.Literal("VERIFIED"),
  Schema.Literal("VIP_REGIONS"),
  Schema.Literal("WELCOME_SCREEN_ENABLED"),
  Schema.String, // fallback for unknown future features
);
export type GuildFeature = typeof GuildFeature.Type;

// ============================================================================
// User Schema
// ============================================================================

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

// ============================================================================
// Role Schemas
// ============================================================================

export const DiscordRoleColors = Schema.Struct({
  primary_color: Schema.Number,
  secondary_color: Schema.optional(Schema.NullOr(Schema.Number)),
  tertiary_color: Schema.optional(Schema.NullOr(Schema.Number)),
});

export const DiscordRoleTags = Schema.Struct({
  bot_id: Schema.optional(Schema.String),
  integration_id: Schema.optional(Schema.String),
  premium_subscriber: Schema.optional(Schema.NullOr(Schema.Undefined)),
  subscription_listing_id: Schema.optional(Schema.String),
  available_for_purchase: Schema.optional(Schema.NullOr(Schema.Undefined)),
  guild_connections: Schema.optional(Schema.NullOr(Schema.Undefined)),
});

export const DiscordRole = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  permissions: Schema.String,
  position: Schema.Number,
  color: Schema.Number,
  colors: DiscordRoleColors,
  hoist: Schema.Boolean,
  managed: Schema.Boolean,
  mentionable: Schema.Boolean,
  icon: Schema.optional(Schema.NullOr(Schema.String)),
  unicode_emoji: Schema.optional(Schema.NullOr(Schema.String)),
  tags: Schema.optional(DiscordRoleTags),
  flags: Schema.Number,
});

export type DiscordRole = typeof DiscordRole.Type;

// ============================================================================
// Channel Schemas
// ============================================================================

export const ChannelPermissionOverwrite = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal(0, 1),
  allow: Schema.String,
  deny: Schema.String,
});

export const ForumTag = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  moderated: Schema.Boolean,
  emoji_id: Schema.optional(Schema.NullOr(Schema.String)),
  emoji_name: Schema.optional(Schema.NullOr(Schema.String)),
});

export const DefaultReactionEmoji = Schema.Struct({
  emoji_id: Schema.optional(Schema.NullOr(Schema.String)),
  emoji_name: Schema.optional(Schema.NullOr(Schema.String)),
});

// Base channel schema (common fields)
const DiscordChannelBase = {
  id: Schema.String,
  flags: Schema.Number,
  last_message_id: Schema.optional(Schema.NullOr(Schema.String)),
  last_pin_timestamp: Schema.optional(Schema.NullOr(Schema.String)),
};

// DM Channel (type 1)
export const DiscordDMChannel = Schema.Struct({
  ...DiscordChannelBase,
  type: Schema.Literal(1),
  recipients: Schema.Array(DiscordUser),
});

// Group DM Channel (type 3)
export const DiscordGroupDMChannel = Schema.Struct({
  ...DiscordChannelBase,
  type: Schema.Literal(3),
  recipients: Schema.Array(DiscordUser),
  name: Schema.optional(Schema.NullOr(Schema.String)),
  icon: Schema.optional(Schema.NullOr(Schema.String)),
  owner_id: Schema.String,
  managed: Schema.optional(Schema.Boolean),
  application_id: Schema.optional(Schema.String),
});

// Guild Channel (types 0, 2, 4, 5, 13, 14, 15, 16)
export const DiscordGuildChannel = Schema.Struct({
  ...DiscordChannelBase,
  type: Schema.Literal(0, 2, 4, 5, 13, 14, 15, 16),
  guild_id: Schema.String,
  name: Schema.String,
  parent_id: Schema.optional(Schema.NullOr(Schema.String)),
  position: Schema.Number,
  permission_overwrites: Schema.optional(Schema.Array(ChannelPermissionOverwrite)),
  // Text channel specific
  topic: Schema.optional(Schema.NullOr(Schema.String)),
  nsfw: Schema.optional(Schema.Boolean),
  rate_limit_per_user: Schema.optional(Schema.Number),
  // Voice channel specific
  bitrate: Schema.optional(Schema.Number),
  user_limit: Schema.optional(Schema.Number),
  rtc_region: Schema.optional(Schema.NullOr(Schema.String)),
  video_quality_mode: Schema.optional(VideoQualityMode),
  // Thread specific settings
  default_auto_archive_duration: Schema.optional(ThreadAutoArchiveDuration),
  default_thread_rate_limit_per_user: Schema.optional(Schema.Number),
  // Forum specific
  available_tags: Schema.optional(Schema.Array(ForumTag)),
  default_reaction_emoji: Schema.optional(Schema.NullOr(DefaultReactionEmoji)),
  default_sort_order: Schema.optional(Schema.NullOr(Schema.Literal(0, 1))),
  default_forum_layout: Schema.optional(Schema.NullOr(ForumLayout)),
  default_tag_setting: Schema.optional(Schema.NullOr(ThreadSearchTagSetting)),
  // Permissions for the invoking user
  permissions: Schema.optional(Schema.NullOr(Schema.String)),
});

// Thread Channel (types 10, 11, 12)
export const DiscordThread = Schema.Struct({
  ...DiscordChannelBase,
  type: Schema.Literal(10, 11, 12),
  guild_id: Schema.String,
  name: Schema.String,
  parent_id: Schema.optional(Schema.NullOr(Schema.String)),
  // Thread specific - optional to handle inactive/newly-created threads
  owner_id: Schema.String,
  member_count: Schema.optional(Schema.Number),
  message_count: Schema.optional(Schema.Number),
  total_message_sent: Schema.optional(Schema.Number),
  rate_limit_per_user: Schema.optional(Schema.Number),
  // Thread metadata
  thread_metadata: Schema.Struct({
    archived: Schema.Boolean,
    auto_archive_duration: ThreadAutoArchiveDuration,
    archive_timestamp: Schema.optional(Schema.NullOr(Schema.String)),
    locked: Schema.Boolean,
    invitable: Schema.optional(Schema.Boolean),
    create_timestamp: Schema.optional(Schema.String),
  }),
});

// Unknown channel type for future Discord channel types
const UnknownChannel = Schema.Struct({
  ...DiscordChannelBase,
  type: Schema.Number, // Accept any channel type not covered above
});

// Union of all channel types - matches GetChannel200 from dfx with fallback for unknown types
export const DiscordChannel = Schema.Union(
  DiscordDMChannel,
  DiscordGroupDMChannel,
  DiscordGuildChannel,
  DiscordThread,
  UnknownChannel,
);
export type DiscordChannel = typeof DiscordChannel.Type;

// ============================================================================
// Member Schema
// ============================================================================

// Note: The cache stores members without "deaf" | "flags" | "joined_at" | "mute"
// as per the membersWithReverseLookup definition
export const DiscordMember = Schema.Struct({
  user: DiscordUser,
  nick: Schema.optional(Schema.NullOr(Schema.String)),
  avatar: Schema.optional(Schema.NullOr(Schema.String)),
  roles: Schema.Array(Schema.String),
  // joined_at is omitted in cache
  // deaf is omitted in cache
  // mute is omitted in cache
  // flags is omitted in cache
  premium_since: Schema.optional(Schema.NullOr(Schema.String)),
  pending: Schema.optional(Schema.Boolean),
  communication_disabled_until: Schema.optional(Schema.NullOr(Schema.String)),
});

export type DiscordMember = typeof DiscordMember.Type;

// ============================================================================
// Emoji Schema
// ============================================================================

export const DiscordEmoji = Schema.Struct({
  id: Schema.String,
  name: Schema.optional(Schema.NullOr(Schema.String)),
  user: Schema.optional(DiscordUser),
  roles: Schema.Array(Schema.String),
  require_colons: Schema.optional(Schema.Boolean),
  managed: Schema.optional(Schema.Boolean),
  animated: Schema.optional(Schema.Boolean),
  available: Schema.optional(Schema.Boolean),
});

export type DiscordEmoji = typeof DiscordEmoji.Type;

// ============================================================================
// Sticker Schema
// ============================================================================

export const DiscordSticker = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  tags: Schema.String,
  type: Schema.Union(Schema.Literal(2), Schema.Number), // Guild stickers only have type 2, with fallback
  format_type: Schema.optional(Schema.NullOr(StickerFormatTypes)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  available: Schema.Boolean,
  guild_id: Schema.String,
  user: Schema.optional(DiscordUser),
});

export type DiscordSticker = typeof DiscordSticker.Type;

// ============================================================================
// Guild Schema
// ============================================================================

export const DiscordGuild = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  icon: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  splash: Schema.optional(Schema.NullOr(Schema.String)),
  discovery_splash: Schema.optional(Schema.NullOr(Schema.String)),
  features: Schema.Array(GuildFeature),
  banner: Schema.optional(Schema.NullOr(Schema.String)),
  owner_id: Schema.String,
  application_id: Schema.optional(Schema.NullOr(Schema.String)),
  region: Schema.optional(Schema.NullOr(Schema.String)),
  afk_channel_id: Schema.optional(Schema.NullOr(Schema.String)),
  afk_timeout: Schema.Number,
  system_channel_id: Schema.optional(Schema.NullOr(Schema.String)),
  system_channel_flags: Schema.Number,
  widget_enabled: Schema.optional(Schema.Boolean),
  widget_channel_id: Schema.optional(Schema.NullOr(Schema.String)),
  verification_level: VerificationLevels,
  roles: Schema.Array(DiscordRole),
  default_message_notifications: UserNotificationSettings,
  mfa_level: GuildMFALevel,
  explicit_content_filter: GuildExplicitContentFilterTypes,
  max_presences: Schema.optional(Schema.NullOr(Schema.Number)),
  max_members: Schema.optional(Schema.Number),
  max_video_channel_users: Schema.optional(Schema.Number),
  max_stage_video_channel_users: Schema.optional(Schema.Number),
  vanity_url_code: Schema.optional(Schema.NullOr(Schema.String)),
  premium_tier: PremiumGuildTiers,
  premium_subscription_count: Schema.optional(Schema.Number),
  preferred_locale: AvailableLocalesEnum,
  rules_channel_id: Schema.optional(Schema.NullOr(Schema.String)),
  safety_alerts_channel_id: Schema.optional(Schema.NullOr(Schema.String)),
  public_updates_channel_id: Schema.optional(Schema.NullOr(Schema.String)),
  premium_progress_bar_enabled: Schema.Boolean,
  nsfw: Schema.Boolean,
  nsfw_level: GuildNSFWContentLevel,
  emojis: Schema.Array(DiscordEmoji),
  stickers: Schema.Array(DiscordSticker),
  approximate_member_count: Schema.optional(Schema.Number),
  approximate_presence_count: Schema.optional(Schema.Number),
});

export type DiscordGuild = typeof DiscordGuild.Type;

export const DiscordApplicationOwner = Schema.Struct({
  id: Schema.String,
});

export const DiscordApplicationSchema = Schema.Struct({
  id: Schema.String,
  owner: DiscordApplicationOwner,
});

export type DiscordApplicationSchema = typeof DiscordApplicationSchema.Type;

// ============================================================================
// Cache Entry Schemas (for API responses)
// ============================================================================

export const ChannelCacheEntrySchema = Schema.Struct({
  parentId: Schema.String,
  resourceId: Schema.String,
  value: DiscordChannel,
});

export const RoleCacheEntrySchema = Schema.Struct({
  parentId: Schema.String,
  resourceId: Schema.String,
  value: DiscordRole,
});

export const MemberCacheEntrySchema = Schema.Struct({
  parentId: Schema.String,
  resourceId: Schema.String,
  value: DiscordMember,
});

export const ChannelCacheEntriesSchema = Schema.Array(ChannelCacheEntrySchema);
export const RoleCacheEntriesSchema = Schema.Array(RoleCacheEntrySchema);
export const MemberCacheEntriesSchema = Schema.Array(MemberCacheEntrySchema);

// Single value responses
export const GuildValueSchema = Schema.Struct({
  value: DiscordGuild,
});

export const ChannelValueSchema = Schema.Struct({
  value: DiscordChannel,
});

export const RoleValueSchema = Schema.Struct({
  value: DiscordRole,
});

export const MemberValueSchema = Schema.Struct({
  value: DiscordMember,
});

export const ApplicationValueSchema = Schema.Struct({
  ownerId: Schema.String,
});

// Size response
export const CacheSizeSchema = Schema.Struct({
  size: Schema.Number,
});

// Not found error
export class CacheNotFoundError extends Schema.TaggedError<CacheNotFoundError>()(
  "CacheNotFoundError",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 404 }),
) {}

// Readonly cache error
export class CacheReadonlyError extends Schema.TaggedError<CacheReadonlyError>()(
  "CacheReadonlyError",
  { message: Schema.String },
) {}
