import { Schema } from "effect";

const AuthorizationErrorData = Schema.Struct({
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { nullable: true }),
});
const AuthorizationErrorTaggedError: Schema.TaggedErrorClass<
  AuthorizationError,
  "AuthorizationError",
  {
    readonly _tag: Schema.tag<"AuthorizationError">;
  } & (typeof AuthorizationErrorData)["fields"]
> = Schema.TaggedError<AuthorizationError>()("AuthorizationError", AuthorizationErrorData);
export class AuthorizationError extends AuthorizationErrorTaggedError {}

export const makeAuthorizationError = (message: string, cause?: unknown) =>
  new AuthorizationError({ message, cause });
