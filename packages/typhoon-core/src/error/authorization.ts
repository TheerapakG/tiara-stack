import { Schema } from "effect";

export class AuthorizationError extends Schema.TaggedErrorClass<AuthorizationError>()(
  "AuthorizationError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const makeAuthorizationError = (message: string, cause?: unknown) =>
  new AuthorizationError({ message, cause });
