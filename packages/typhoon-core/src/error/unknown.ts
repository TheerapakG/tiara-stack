import { Schema } from "effect";

export class UnknownError extends Schema.TaggedErrorClass<UnknownError>()("UnknownError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export const makeUnknownError = (message: string, cause?: unknown) =>
  new UnknownError({ message, cause });
