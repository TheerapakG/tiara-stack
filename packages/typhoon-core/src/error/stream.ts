import { Schema } from "effect";

const StreamExhaustedErrorData = Schema.Struct({
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { nullable: true }),
});
const StreamExhaustedErrorTaggedError: Schema.TaggedErrorClass<
  StreamExhaustedError,
  "StreamExhaustedError",
  {
    readonly _tag: Schema.tag<"StreamExhaustedError">;
  } & (typeof StreamExhaustedErrorData)["fields"]
> = Schema.TaggedError<StreamExhaustedError>()(
  "StreamExhaustedError",
  StreamExhaustedErrorData,
);
export class StreamExhaustedError extends StreamExhaustedErrorTaggedError {}

export const makeStreamExhaustedError = (message: string, cause?: unknown) =>
  new StreamExhaustedError({ message, cause });
