import { Schema } from "effect";

export class ArgumentError extends Schema.TaggedErrorClass<ArgumentError>()("ArgumentError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export const makeArgumentError = (message: string, cause?: unknown) =>
  new ArgumentError({ message, cause });
