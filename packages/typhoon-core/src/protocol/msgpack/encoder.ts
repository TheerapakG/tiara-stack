import { encode as msgpackEncode } from "@msgpack/msgpack";
import { Effect, pipe } from "effect";

export const encode = (input: unknown) =>
  pipe(
    Effect.sync(() => msgpackEncode(input)),
    Effect.withSpan("Msgpack.Encoder.encode", {
      captureStackTrace: true,
    }),
  );
