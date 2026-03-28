import { Schema } from "effect";
import {
  AvailableLocalesEnum,
  GuildExplicitContentFilterTypes,
  GuildFeature,
  GuildMFALevel,
  GuildNSFWContentLevel,
  PremiumGuildTiers,
  UserNotificationSettings,
  VerificationLevels,
} from "./enums";
import { DiscordEmoji } from "./emoji";
import { DiscordRole } from "./role";
import { DiscordSticker } from "./sticker";

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
