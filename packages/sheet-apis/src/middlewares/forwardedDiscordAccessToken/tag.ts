import { Context, Option, Redacted } from "effect";

export const ForwardedDiscordAccessToken = Context.Reference<
  Option.Option<Redacted.Redacted<string>>
>("ForwardedDiscordAccessToken", {
  defaultValue: () => Option.none(),
});
