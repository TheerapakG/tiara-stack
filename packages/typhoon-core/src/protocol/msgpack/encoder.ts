import { encode as msgpackEncode } from "@msgpack/msgpack";
import { Data, Effect, pipe } from "effect";

export class MsgpackEncodeError extends Data.TaggedError("MsgpackEncodeError")<{
  error: Error;
}> {}

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
