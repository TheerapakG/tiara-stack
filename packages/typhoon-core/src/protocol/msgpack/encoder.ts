import { encode as msgpackEncode } from "@msgpack/msgpack";
import { Cause, Data, Effect, pipe } from "effect";

type MsgpackEncodeErrorData = {
  error: Error;
};
const MsgpackEncodeErrorTaggedError: new (
  args: Readonly<MsgpackEncodeErrorData>,
) => Cause.YieldableError & {
  readonly _tag: "MsgpackEncodeError";
} & Readonly<MsgpackEncodeErrorData> = Data.TaggedError(
  "MsgpackEncodeError",
)<MsgpackEncodeErrorData>;
export class MsgpackEncodeError extends MsgpackEncodeErrorTaggedError {}

export const encode = (input: unknown) =>
  pipe(
    Effect.try(() => msgpackEncode(input)),
    Effect.catchTag("UnknownException", (error) =>
      Effect.fail(new MsgpackEncodeError({ error: error.error as Error })),
    ),
    Effect.withSpan("Msgpack.Encoder.encode", {
      captureStackTrace: true,
    }),
  );
