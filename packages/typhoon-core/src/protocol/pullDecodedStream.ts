import { decodeMulti, decodeMultiStream } from "@msgpack/msgpack";
import { Effect, Function, pipe, Scope, Stream } from "effect";

export const blobToPullDecodedStream = (blob: Blob) =>
  pipe(
    Effect.Do,
    Effect.bind("scope", () => Effect.scope),
    Effect.let("stream", () => blob.stream()),
    Effect.let("decodedStream", ({ stream }) =>
      pipe(
        Stream.fromAsyncIterable(decodeMultiStream(stream), Function.identity),
        Stream.rechunk(1),
      ),
    ),
    Effect.bind("pullDecodedStream", ({ decodedStream, scope }) =>
      pipe(Stream.toPull(decodedStream), Scope.extend(scope)),
    ),
    Effect.map(({ pullDecodedStream }) => pullDecodedStream),
    Effect.withSpan("blobToPullDecodedStream"),
  );

export const bytesToPullDecodedStream = (bytes: Uint8Array) =>
  pipe(
    Effect.Do,
    Effect.bind("scope", () => Effect.scope),
    Effect.let("decodedStream", () =>
      pipe(Stream.fromIterable(decodeMulti(bytes)), Stream.rechunk(1)),
    ),
    Effect.bind("pullDecodedStream", ({ decodedStream, scope }) =>
      pipe(Stream.toPull(decodedStream), Scope.extend(scope)),
    ),
    Effect.map(({ pullDecodedStream }) => pullDecodedStream),
    Effect.withSpan("blobToPullDecodedStream"),
  );
