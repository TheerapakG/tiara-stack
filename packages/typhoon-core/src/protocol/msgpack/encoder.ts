import { encode as msgpackEncode } from "@msgpack/msgpack";
import { Effect, pipe } from "effect";
import { makeMsgpackEncodeError } from "~/error";

export const encode = (input: unknown) =>
  pipe(
    Effect.try({
      try: () => msgpackEncode(input),
      catch: (error) => makeMsgpackEncodeError(error as Error),
    }),
    Effect.withSpan("Msgpack.Encoder.encode", {
      captureStackTrace: true,
    }),
  );
