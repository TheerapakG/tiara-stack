import { Schema } from "effect";

export const VideoQualityMode = Schema.Union([Schema.Literals([1, 2]), Schema.Number]);
export type VideoQualityMode = typeof VideoQualityMode.Type;

export const ThreadAutoArchiveDuration = Schema.Union([
  Schema.Literals([60, 1440, 4320, 10080]),
  Schema.Number,
]);
export type ThreadAutoArchiveDuration = typeof ThreadAutoArchiveDuration.Type;

export const ForumLayout = Schema.Union([Schema.Literals([0, 1, 2]), Schema.Number]);
export type ForumLayout = typeof ForumLayout.Type;

export const ThreadSearchTagSetting = Schema.Union([
  Schema.Literals(["match_all", "match_some"]),
  Schema.String,
]);
export type ThreadSearchTagSetting = typeof ThreadSearchTagSetting.Type;

export const VerificationLevels = Schema.Union([Schema.Literals([0, 1, 2, 3, 4]), Schema.Number]);
export type VerificationLevels = typeof VerificationLevels.Type;

export const UserNotificationSettings = Schema.Union([Schema.Literals([0, 1]), Schema.Number]);
export type UserNotificationSettings = typeof UserNotificationSettings.Type;

export const GuildMFALevel = Schema.Union([Schema.Literals([0, 1]), Schema.Number]);
export type GuildMFALevel = typeof GuildMFALevel.Type;

export const GuildExplicitContentFilterTypes = Schema.Union([
  Schema.Literals([0, 1, 2]),
  Schema.Number,
]);
export type GuildExplicitContentFilterTypes = typeof GuildExplicitContentFilterTypes.Type;

export const PremiumGuildTiers = Schema.Union([Schema.Literals([0, 1, 2, 3]), Schema.Number]);
export type PremiumGuildTiers = typeof PremiumGuildTiers.Type;

export const GuildNSFWContentLevel = Schema.Union([Schema.Literals([0, 1, 2, 3]), Schema.Number]);
export type GuildNSFWContentLevel = typeof GuildNSFWContentLevel.Type;

export const StickerFormatTypes = Schema.Union([Schema.Literals([1, 2, 3, 4]), Schema.Number]);
export type StickerFormatTypes = typeof StickerFormatTypes.Type;

export const AvailableLocalesEnum = Schema.Union([
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
  Schema.String,
]);
export type AvailableLocalesEnum = typeof AvailableLocalesEnum.Type;

export const GuildFeature = Schema.Union([
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
  Schema.String,
]);
export type GuildFeature = typeof GuildFeature.Type;
