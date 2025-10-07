import {
  DiscordjsError,
  DiscordjsRangeError,
  DiscordjsTypeError,
} from "discord.js";
import { Cause, Data, Effect, Either, Function, pipe, Schema } from "effect";

export type Constructor<Instance> = abstract new (...args: never[]) => Instance;

export class DiscordError extends Data.TaggedError("DiscordError")<{
  readonly message: string;
  readonly cause: DiscordjsError | DiscordjsTypeError | DiscordjsRangeError;
}> {
  static fromUnknownException = (cause: Cause.UnknownException) => {
    return pipe(
      cause.error,
      Schema.decodeUnknown(
        pipe(
          Schema.Union(
            Schema.instanceOf(
              DiscordjsError as unknown as Constructor<DiscordjsError>,
            ),
            Schema.instanceOf(
              DiscordjsTypeError as unknown as Constructor<DiscordjsTypeError>,
            ),
            Schema.instanceOf(
              DiscordjsRangeError as unknown as Constructor<DiscordjsRangeError>,
            ),
          ),
        ),
      ),
      Effect.either,
      Effect.map(
        Either.match({
          onLeft: () => cause,
          onRight: (error) =>
            new DiscordError({ message: error.message, cause: error }),
        }),
      ),
    );
  };

  static wrapTry = <A>(thunk: Function.LazyArg<A>) =>
    pipe(
      Effect.try(thunk),
      Effect.catchTag("UnknownException", (cause) =>
        pipe(DiscordError.fromUnknownException(cause), Effect.flip),
      ),
    );

  static wrapTryPromise = <A>(
    evaluate: (signal: AbortSignal) => PromiseLike<A>,
  ) =>
    pipe(
      Effect.tryPromise(evaluate),
      Effect.catchTag("UnknownException", (cause) =>
        pipe(DiscordError.fromUnknownException(cause), Effect.flip),
      ),
    );
}
