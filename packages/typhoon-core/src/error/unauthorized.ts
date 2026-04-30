import { Schema } from "effect";

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
  "Unauthorized",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
  { httpApiStatus: 401 },
) {}

export const makeUnauthorized = (message: string, cause?: unknown) =>
  new Unauthorized({ message, cause });
