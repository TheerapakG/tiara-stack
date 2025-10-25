import { Cause, Data } from "effect";

type AuthorizationErrorData = {
  message: string;
  cause?: unknown;
};
const AuthorizationErrorTaggedError: new (
  args: Readonly<AuthorizationErrorData>,
) => Cause.YieldableError & {
  readonly _tag: "AuthorizationError";
} & Readonly<AuthorizationErrorData> = Data.TaggedError(
  "AuthorizationError",
)<AuthorizationErrorData>;
export class AuthorizationError extends AuthorizationErrorTaggedError {}

export const makeAuthorizationError = (message: string, cause?: unknown) =>
  new AuthorizationError({ message, cause });
