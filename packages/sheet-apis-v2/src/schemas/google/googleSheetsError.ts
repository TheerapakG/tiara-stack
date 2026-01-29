import { Schema } from "effect";

export class GoogleSheetsError extends Schema.TaggedError<GoogleSheetsError>()(
  "GoogleSheetsError",
  {
    message: Schema.String,
    cause: Schema.Unknown,
  },
) {}
