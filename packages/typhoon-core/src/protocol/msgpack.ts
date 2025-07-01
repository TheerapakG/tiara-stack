import {
  DecodeError,
  decodeMulti,
  decodeMultiStream,
  encode,
} from "@msgpack/msgpack";
import { Data, Effect, pipe, Stream } from "effect";
import { streamToPullDecodedStream } from "./stream";

export class MsgpackDecodeError extends Data.TaggedError("MsgpackDecodeError")<{
  error: RangeError | DecodeError;
}> {}

export class MsgpackEncoderDecoder {
  static encode(input: unknown) {
    return pipe(
      Effect.sync(() => encode(input)),
      Effect.withSpan("MsgpackEncoderDecoder.encode", {
        captureStackTrace: true,
      }),
    );
  }

  static blobToDecodedStream(blob: Blob) {
    return pipe(
      Stream.fromAsyncIterable(
        decodeMultiStream(blob.stream()),
        (error) =>
          new MsgpackDecodeError({ error: error as RangeError | DecodeError }),
      ),
      Stream.rechunk(1),
      Stream.withSpan("MsgpackEncoderDecoder.blobToDecodedStream", {
        captureStackTrace: true,
      }),
    );
  }

  static bytesToDecodedStream(bytes: Uint8Array) {
    return pipe(
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
      Stream.withSpan("MsgpackEncoderDecoder.bytesToDecodedStream", {
        captureStackTrace: true,
      }),
    );
  }

  static blobToPullDecodedStream(blob: Blob) {
    return pipe(
      this.blobToDecodedStream(blob),
      streamToPullDecodedStream,
      Effect.withSpan("MsgpackEncoderDecoder.blobToPullDecodedStream", {
        captureStackTrace: true,
      }),
    );
  }

  static bytesToPullDecodedStream(bytes: Uint8Array) {
    return pipe(
      this.bytesToDecodedStream(bytes),
      streamToPullDecodedStream,
      Effect.withSpan("MsgpackEncoderDecoder.bytesToPullDecodedStream", {
        captureStackTrace: true,
      }),
    );
  }
}
