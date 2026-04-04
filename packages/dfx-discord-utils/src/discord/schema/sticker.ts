import { Schema } from "effect";
import { StickerFormatTypes } from "./enums";
import { DiscordUser } from "./user";

export const DiscordSticker = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  tags: Schema.String,
  type: Schema.Union([Schema.Literal(2), Schema.Number]),
  format_type: Schema.optional(Schema.NullOr(StickerFormatTypes)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  available: Schema.Boolean,
  guild_id: Schema.String,
  user: Schema.optional(DiscordUser),
});

export type DiscordSticker = typeof DiscordSticker.Type;
