import { Schema } from "effect";
import { DecodeError } from "@msgpack/msgpack";

// TODO: omit cause when encoding
const MsgpackDecodeErrorData = Schema.Struct({
  message: Schema.String,
  cause: Schema.Unknown, // Schema.Union(RangeErrorSchema, DecodeErrorSchema),
});
const MsgpackDecodeErrorTaggedError: Schema.TaggedErrorClass<
  MsgpackDecodeError,
  "MsgpackDecodeError",
  {
    readonly _tag: Schema.tag<"MsgpackDecodeError">;
  } & (typeof MsgpackDecodeErrorData)["fields"]
> = Schema.TaggedError<MsgpackDecodeError>()("MsgpackDecodeError", MsgpackDecodeErrorData);
export class MsgpackDecodeError extends MsgpackDecodeErrorTaggedError {}

export const makeMsgpackDecodeError = (cause: RangeError | DecodeError) =>
  new MsgpackDecodeError({
    message: `Failed to decode Msgpack data: ${cause.message}`,
    cause,
  });

const ErrorSchema = Schema.declare((input: unknown) => input instanceof Error);

// TODO: omit cause when encoding
const MsgpackEncodeErrorData = Schema.Struct({
  message: Schema.String,
  cause: ErrorSchema,
});
const MsgpackEncodeErrorTaggedError: Schema.TaggedErrorClass<
  MsgpackEncodeError,
  "MsgpackEncodeError",
  {
    readonly _tag: Schema.tag<"MsgpackEncodeError">;
  } & (typeof MsgpackEncodeErrorData)["fields"]
> = Schema.TaggedError<MsgpackEncodeError>()("MsgpackEncodeError", MsgpackEncodeErrorData);
export class MsgpackEncodeError extends MsgpackEncodeErrorTaggedError {}

export const makeMsgpackEncodeError = (cause: Error) =>
  new MsgpackEncodeError({
    message: `Failed to encode Msgpack data: ${cause.message}`,
    cause,
  });
