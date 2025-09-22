import { loadConfig } from "c12";
import { Effect, pipe, Schema } from "effect";
import { Validate } from "typhoon-core/validator";

export class Config extends Effect.Service<Config>()("Config", {
  effect: pipe(
    Effect.tryPromise(() => loadConfig({ dotenv: true })),
    Effect.andThen(
      Validate.validate(
        pipe(
          Schema.Struct({
            POSTGRES_URL: Schema.String,
          }),
          Schema.rename({ POSTGRES_URL: "postgresUrl" }),
          Schema.standardSchemaV1,
        ),
      )(process.env),
    ),
  ),
}) {}
