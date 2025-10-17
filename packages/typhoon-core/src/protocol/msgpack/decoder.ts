import { DecodeError, decodeMulti, decodeMultiStream } from "@msgpack/msgpack";
import { Cause, Data, Effect, pipe, Stream } from "effect";

type MsgpackDecodeErrorData = {
  error: RangeError | DecodeError;
};
const MsgpackDecodeErrorTaggedError: new (
  args: Readonly<MsgpackDecodeErrorData>,
) => Cause.YieldableError & {
  readonly _tag: "MsgpackDecodeError";
} & Readonly<MsgpackDecodeErrorData> = Data.TaggedError(
  "MsgpackDecodeError",
)<MsgpackDecodeErrorData>;
export class MsgpackDecodeError extends MsgpackDecodeErrorTaggedError {}

export const blobToStream = (blob: Blob) =>
  pipe(
    Stream.fromAsyncIterable(
      decodeMultiStream(blob.stream()),
      (error) =>
        new MsgpackDecodeError({ error: error as RangeError | DecodeError }),
    ),
    Stream.rechunk(1),
    Stream.withSpan("Msgpack.Decoder.blobToStream", {
      captureStackTrace: true,
    }),
  );

export const bytesToStream = (bytes: Uint8Array) =>
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
    Stream.withSpan("Msgpack.Decoder.bytesToStream", {
      captureStackTrace: true,
    }),
  );
