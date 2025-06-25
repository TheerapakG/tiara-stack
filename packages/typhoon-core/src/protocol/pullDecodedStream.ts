import { DecodeError, decodeMulti, decodeMultiStream } from "@msgpack/msgpack";
import { Data, Effect, Option, pipe, Scope, Stream } from "effect";

export class MsgpackDecodeError extends Data.TaggedError("MsgpackDecodeError")<{
  error: RangeError | DecodeError;
}> {}

export class StreamExhaustedError extends Data.TaggedError(
  "StreamExhaustedError",
) {}

const blobToDecodedStream = (blob: Blob) =>
  pipe(
    Stream.fromAsyncIterable(
      decodeMultiStream(blob.stream()),
      (error) =>
        new MsgpackDecodeError({ error: error as RangeError | DecodeError }),
    ),
    Stream.rechunk(1),
  );

const bytesToDecodedStream = (bytes: Uint8Array) =>
  pipe(
    Stream.fromIterableEffect(
      pipe(
        Effect.try(() => decodeMulti(bytes)),
        Effect.catchAll((error) =>
          Effect.fail(
            new MsgpackDecodeError({
              error: error.error as RangeError | DecodeError,
            }),
          ),
        ),
      ),
    ),
    Stream.rechunk(1),
  );

const decodedStreamToPullDecodedStream = (
  stream: Stream.Stream<unknown, MsgpackDecodeError, never>,
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

export const blobToPullDecodedStream = (blob: Blob) =>
  pipe(blobToDecodedStream(blob), decodedStreamToPullDecodedStream);

export const bytesToPullDecodedStream = (bytes: Uint8Array) =>
  pipe(bytesToDecodedStream(bytes), decodedStreamToPullDecodedStream);
