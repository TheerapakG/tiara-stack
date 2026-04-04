import { Schema } from "effect";

export class SheetConfigError extends Schema.TaggedErrorClass<SheetConfigError>()(
  "SheetConfigError",
  {
    message: Schema.String,
  },
) {}
