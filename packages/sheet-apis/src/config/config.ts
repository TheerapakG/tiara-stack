import { type } from "arktype";
import { loadConfig } from "c12";
import { Effect, pipe } from "effect";
import { validate } from "typhoon-core/schema";

export class Config extends Effect.Service<Config>()("Config", {
  effect: pipe(
    Effect.tryPromise(() => loadConfig({ dotenv: true })),
    Effect.andThen(
      validate(
        type({
          POSTGRES_URL: "string",
        }).pipe(({ POSTGRES_URL }) => ({
          postgresUrl: POSTGRES_URL,
        })),
      )(process.env),
    ),
  ),
}) {}
