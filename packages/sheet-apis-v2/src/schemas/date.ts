import { Schema } from "effect";

export const DateFromUnknown = Schema.Union(Schema.DateFromSelf, Schema.DateFromNumber);

export const DateTimeUtcFromUnknown = Schema.Union(
  Schema.DateTimeUtcFromDate,
  Schema.DateTimeUtcFromNumber,
);
