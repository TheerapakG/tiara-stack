import { Schema } from "effect";

const ArgumentErrorData = Schema.Struct({
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { nullable: true }),
});
const ArgumentErrorTaggedError: Schema.TaggedErrorClass<
  ArgumentError,
  "ArgumentError",
  {
    readonly _tag: Schema.tag<"ArgumentError">;
  } & (typeof ArgumentErrorData)["fields"]
> = Schema.TaggedError<ArgumentError>()("ArgumentError", ArgumentErrorData);
export class ArgumentError extends ArgumentErrorTaggedError {}

export const makeArgumentError = (message: string, cause?: unknown) =>
  new ArgumentError({ message, cause });
