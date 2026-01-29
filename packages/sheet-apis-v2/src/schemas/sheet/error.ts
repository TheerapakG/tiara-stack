import { Schema } from "effect";

export class ParserFieldError extends Schema.TaggedError<ParserFieldError>()("ParserFieldError", {
  message: Schema.String,
  range: Schema.Unknown,
  field: Schema.String,
}) {}
