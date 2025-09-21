import {
  Chunk,
  Data,
  Effect,
  Function,
  Option,
  pipe,
  Scope,
  Stream,
} from "effect";

export class StreamExhaustedError extends Data.TaggedError(
  "StreamExhaustedError",
) {}

export const toPullStream = <A, E, R>(
  stream: Stream.Stream<A, E, R>,
): Effect.Effect<
  Effect.Effect<A, StreamExhaustedError | E, R>,
  never,
  R | Scope.Scope
> =>
  pipe(
    Effect.Do,
    Effect.bind("scope", () => Effect.scope),
    Effect.bind("pullStream", ({ scope }) =>
      pipe(stream, Stream.rechunk(1), Stream.toPull, Scope.extend(scope)),
    ),
    Effect.map(({ pullStream }) =>
      pipe(
        pullStream,
        Effect.map(Chunk.get(0)),
        Effect.mapError(
          Option.match({
            onSome: Function.identity,
            onNone: () => new StreamExhaustedError(),
          }),
        ),
        Effect.flatMap(
          Option.match({
            onSome: Effect.succeed,
            onNone: () => Effect.fail(new StreamExhaustedError()),
          }),
        ),
      ),
    ),
    Effect.withSpan("Stream.toPullStream"),
  );
