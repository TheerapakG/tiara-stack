import { Schema } from "effect";

const UnknownErrorData = Schema.Struct({
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { nullable: true }),
});
const UnknownErrorTaggedError: Schema.TaggedErrorClass<
  UnknownError,
  "UnknownError",
  {
    readonly _tag: Schema.tag<"UnknownError">;
  } & (typeof UnknownErrorData)["fields"]
> = Schema.TaggedError<UnknownError>()("UnknownError", UnknownErrorData);
export class UnknownError extends UnknownErrorTaggedError {}

export const makeUnknownError = (message: string, cause?: unknown) =>
  new UnknownError({ message, cause });
