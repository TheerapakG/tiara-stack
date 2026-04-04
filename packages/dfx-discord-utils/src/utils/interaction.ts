import { Effect, Option } from "effect";
import { Ix } from "dfx";

export const user = Effect.fn("interaction.user")(function* () {
  const interaction = yield* Ix.Interaction;
  return Option.fromNullishOr(interaction.member?.user).pipe(
    Option.orElse(() => Option.fromNullishOr(interaction.user)),
    Option.getOrThrow,
  );
});

export const member = Effect.fn("interaction.member")(function* () {
  const interaction = yield* Ix.Interaction;
  return Option.fromNullishOr(interaction.member);
});

export const guild = Effect.fn("interaction.guild")(function* () {
  const interaction = yield* Ix.Interaction;
  return Option.fromNullishOr(interaction.guild);
});

export const channel = Effect.fn("interaction.channel")(function* () {
  const interaction = yield* Ix.Interaction;
  return Option.fromNullishOr(interaction.channel);
});

export const message = Effect.fn("interaction.message")(function* () {
  const interaction = yield* Ix.Interaction;
  return Option.fromNullishOr(interaction.message);
});
