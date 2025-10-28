import { Schema } from "effect";

export class SheetConfigError extends Schema.TaggedError<SheetConfigError>()(
  "SheetConfigError",
  {
    message: Schema.String,
  },
) {}
