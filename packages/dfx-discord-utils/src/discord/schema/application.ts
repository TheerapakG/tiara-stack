import { Schema } from "effect";

export const DiscordApplicationOwner = Schema.Struct({
  id: Schema.String,
});

export const DiscordApplicationSchema = Schema.Struct({
  id: Schema.String,
  owner: DiscordApplicationOwner,
});

export type DiscordApplicationSchema = typeof DiscordApplicationSchema.Type;
