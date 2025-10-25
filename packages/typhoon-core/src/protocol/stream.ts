import { Chunk, Effect, Function, Option, pipe, Scope, Stream } from "effect";
import { Stream as StreamError } from "~/error";

export const toPullEffect = <A, E, R>(
  stream: Stream.Stream<A, E, R>,
): Effect.Effect<
  Effect.Effect<A, StreamError.StreamExhaustedError | E, R>,
  never,
  R | Scope.Scope
> =>
  pipe(
    stream,
    Stream.rechunk(1),
    Stream.toPull,
    Effect.map((pullEffect) =>
      pipe(
        pullEffect,
        Effect.map(Chunk.get(0)),
        Effect.flatMap(
          Option.match({
            onSome: Effect.succeed,
            onNone: () => Effect.fail(Option.none<E>()),
          }),
        ),
        Effect.mapError(
          Option.match({
            onSome: Function.identity,
            onNone: () =>
              StreamError.makeStreamExhaustedError("Stream exhausted"),
          }),
        ),
      ),
    ),
    Effect.withSpan("Stream.toPullEffect", {
      captureStackTrace: true,
    }),
  );
