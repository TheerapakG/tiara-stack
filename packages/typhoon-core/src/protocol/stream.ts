import { Data, Effect, Option, pipe, Scope, Stream } from "effect";

export class StreamExhaustedError extends Data.TaggedError(
  "StreamExhaustedError",
) {}

export const streamToPullDecodedStream = <A, E, R>(
  stream: Stream.Stream<A, E, R>,
) =>
  pipe(
    Effect.Do,
    Effect.bind("scope", () => Effect.scope),
    Effect.bind("pullDecodedStream", ({ scope }) =>
      pipe(Stream.toPull(stream), Scope.extend(scope)),
    ),
    Effect.map(({ pullDecodedStream }) =>
      pipe(
        pullDecodedStream,
        Effect.mapError(
          Option.match({
            onSome: (error) => error,
            onNone: () => new StreamExhaustedError(),
          }),
        ),
      ),
    ),
    Effect.withSpan("decodedStreamToPullDecodedStream"),
  );
