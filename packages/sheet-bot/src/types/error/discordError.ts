import { type } from "arktype";
import {
  DiscordjsError,
  DiscordjsRangeError,
  DiscordjsTypeError,
} from "discord.js";
import { Cause, Data, Effect, Function, pipe } from "effect";
import { validate } from "typhoon-core/schema";

export type Constructor<Instance> = abstract new (...args: never[]) => Instance;

export class DiscordError extends Data.TaggedError("DiscordError")<{
  readonly message: string;
  readonly cause: DiscordjsError | DiscordjsTypeError | DiscordjsRangeError;
}> {
  constructor(
    cause: DiscordjsError | DiscordjsTypeError | DiscordjsRangeError,
  ) {
    super({ message: cause.message, cause });
  }

  static fromUnknownException(cause: Cause.UnknownException) {
    return pipe(
      cause.error,
      validate(
        type.or(
          type.instanceOf(
            DiscordjsError as unknown as Constructor<DiscordjsError>,
          ),
          type.instanceOf(
            DiscordjsTypeError as unknown as Constructor<DiscordjsTypeError>,
          ),
          type.instanceOf(
            DiscordjsRangeError as unknown as Constructor<DiscordjsRangeError>,
          ),
        ),
      ),
      Effect.map((error) => new DiscordError(error)),
      Effect.catchTag("ValidationError", () => Effect.succeed(cause)),
    );
  }

  static wrapTry<A>(thunk: Function.LazyArg<A>) {
    return pipe(
      Effect.try(thunk),
      Effect.catchTag("UnknownException", (cause) =>
        pipe(DiscordError.fromUnknownException(cause), Effect.flip),
      ),
    );
  }

  static wrapTryPromise<A>(evaluate: (signal: AbortSignal) => PromiseLike<A>) {
    return pipe(
      Effect.tryPromise(evaluate),
      Effect.catchTag("UnknownException", (cause) =>
        pipe(DiscordError.fromUnknownException(cause), Effect.flip),
      ),
    );
  }
}
