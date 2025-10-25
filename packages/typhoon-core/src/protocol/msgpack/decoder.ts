import { DecodeError, decodeMulti, decodeMultiStream } from "@msgpack/msgpack";
import { Effect, pipe, Stream } from "effect";
import { Msgpack } from "~/error";

export const streamToStream = <E, R>(
  stream: Stream.Stream<Uint8Array, E, R>,
): Stream.Stream<unknown, Msgpack.MsgpackDecodeError, R> =>
  pipe(
    Stream.toReadableStreamEffect(stream),
    Effect.map((stream) =>
      Stream.fromAsyncIterable(decodeMultiStream(stream), (error) =>
        Msgpack.makeMsgpackDecodeError(error as RangeError | DecodeError),
      ),
    ),
    Stream.unwrap,
    Stream.rechunk(1),
    Stream.withSpan("Msgpack.Decoder.streamToStream", {
      captureStackTrace: true,
    }),
  );

export const blobToStream = (blob: Blob) =>
  pipe(
    Stream.fromAsyncIterable(decodeMultiStream(blob.stream()), (error) =>
      Msgpack.makeMsgpackDecodeError(error as RangeError | DecodeError),
    ),
    Stream.rechunk(1),
    Stream.withSpan("Msgpack.Decoder.blobToStream", {
      captureStackTrace: true,
    }),
  );

export const bytesToStream = (bytes: Uint8Array) =>
  pipe(
    Stream.fromIterableEffect(
      Effect.try({
        try: () => decodeMulti(bytes),
        catch: (error) =>
          Msgpack.makeMsgpackDecodeError(error as RangeError | DecodeError),
      }),
    ),
    Stream.rechunk(1),
    Stream.withSpan("Msgpack.Decoder.bytesToStream", {
      captureStackTrace: true,
    }),
  );
