import { Schema } from "effect";

export const HealthResponseSchema = Schema.Struct({
  status: Schema.Literals(["ok"]),
  timestamp: Schema.DateTimeUtcFromMillis,
});
