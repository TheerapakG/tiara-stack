import { Schema } from "effect";

export class DBQueryError extends Schema.TaggedErrorClass<DBQueryError>()(
  "DBQueryError",
  Schema.Struct({
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }),
) {}

export const makeDBQueryError = (message: string, cause?: unknown) =>
  new DBQueryError({ message, cause });
