import { Cause, Data } from "effect";
import { DecodeError } from "@msgpack/msgpack";

type MsgpackDecodeErrorData = {
  message: string;
  cause: RangeError | DecodeError;
};
const MsgpackDecodeErrorTaggedError: new (
  args: Readonly<MsgpackDecodeErrorData>,
) => Cause.YieldableError & {
  readonly _tag: "MsgpackDecodeError";
} & Readonly<MsgpackDecodeErrorData> = Data.TaggedError(
  "MsgpackDecodeError",
)<MsgpackDecodeErrorData>;
export class MsgpackDecodeError extends MsgpackDecodeErrorTaggedError {}

export const makeMsgpackDecodeError = (cause: RangeError | DecodeError) =>
  new MsgpackDecodeError({
    message: `Failed to decode Msgpack data: ${cause.message}`,
    cause,
  });

type MsgpackEncodeErrorData = {
  message: string;
  cause: Error;
};
const MsgpackEncodeErrorTaggedError: new (
  args: Readonly<MsgpackEncodeErrorData>,
) => Cause.YieldableError & {
  readonly _tag: "MsgpackEncodeError";
} & Readonly<MsgpackEncodeErrorData> = Data.TaggedError(
  "MsgpackEncodeError",
)<MsgpackEncodeErrorData>;
export class MsgpackEncodeError extends MsgpackEncodeErrorTaggedError {}

export const makeMsgpackEncodeError = (cause: Error) =>
  new MsgpackEncodeError({
    message: `Failed to encode Msgpack data: ${cause.message}`,
    cause,
  });
