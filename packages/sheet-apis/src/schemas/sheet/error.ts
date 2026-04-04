import { Schema } from "effect";

export class ParserFieldError extends Schema.TaggedErrorClass<ParserFieldError>()(
  "ParserFieldError",
  {
    message: Schema.String,
    range: Schema.Unknown,
    field: Schema.String,
  },
) {}
