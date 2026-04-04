import { Schema } from "effect";

export class ParserFieldError extends Schema.TaggedErrorClass<ParserFieldError>()(
  "ParserFieldError",
  {
    message: Schema.String,
    range: Schema.UnknownFromJsonString,
    field: Schema.String,
  },
) {}
