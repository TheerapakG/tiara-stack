import { Schema } from "effect";
import { DiscordUser } from "./user";

export const DiscordMember = Schema.Struct({
  user: DiscordUser,
  nick: Schema.NullOr(Schema.String),
  avatar: Schema.NullOr(Schema.String),
  banner: Schema.NullOr(Schema.String),
  roles: Schema.Array(Schema.String),
  premium_since: Schema.NullOr(Schema.String),
  pending: Schema.optional(Schema.Boolean),
  communication_disabled_until: Schema.NullOr(Schema.String),
});

export type DiscordMember = typeof DiscordMember.Type;
