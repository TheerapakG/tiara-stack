import { type } from "arktype";
import { Effect, pipe } from "effect";
import { validate } from "typhoon-core/schema";
import { Bot } from "./bot";

const envValidator = validate(
  type({
    DISCORD_TOKEN: "string",
  }).pipe(({ DISCORD_TOKEN }) => ({ discordToken: DISCORD_TOKEN })),
);

await Effect.runPromise(
  pipe(
    Effect.Do,
    Effect.bind("env", () => envValidator(process.env)),
    Effect.bind("bot", () => Bot.create()),
    Effect.flatMap(({ bot, env }) => Bot.login(env.discordToken)(bot)),
  ),
);
