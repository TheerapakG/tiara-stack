import { Schema } from "effect";
import { DiscordUser } from "./user";

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
