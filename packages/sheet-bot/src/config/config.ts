import { type } from "arktype";
import { loadConfig } from "c12";
import { Effect, pipe } from "effect";
import { validate } from "typhoon-core/schema";

export class Config extends Effect.Service<Config>()("Config", {
  effect: () =>
    pipe(
      Effect.tryPromise(() => loadConfig({ dotenv: true })),
      Effect.andThen(
        validate(
          type({
            POSTGRES_URL: "string",
            DISCORD_TOKEN: "string",
          }).pipe(({ POSTGRES_URL, DISCORD_TOKEN }) => ({
            postgresUrl: POSTGRES_URL,
            discordToken: DISCORD_TOKEN,
          })),
        )(process.env),
      ),
    ),
}) {}
