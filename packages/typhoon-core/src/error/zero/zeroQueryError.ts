import { Schema } from "effect";
import type { ReadonlyJSONValue } from "@rocicorp/zero";

export const ReadonlyJSONValueSchema: Schema.Schema<ReadonlyJSONValue> =
  Schema.Union(
    Schema.Null,
    Schema.String,
    Schema.Number,
    Schema.Boolean,
    Schema.Array(Schema.suspend(() => ReadonlyJSONValueSchema)),
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(
        Schema.suspend(() => ReadonlyJSONValueSchema),
        Schema.Undefined,
      ),
    }),
  );

const ZeroQueryErrorData = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  details: ReadonlyJSONValueSchema,
});

export class ZeroQueryAppError extends Schema.TaggedError<ZeroQueryAppError>()(
  "ZeroQueryAppError",
  ZeroQueryErrorData,
) {}

const ZeroQueryHttpErrorData = Schema.Struct({
  ...ZeroQueryErrorData.fields,
  status: Schema.Number,
});

export class ZeroQueryHttpError extends Schema.TaggedError<ZeroQueryHttpError>()(
  "ZeroQueryHttpError",
  ZeroQueryHttpErrorData,
) {}

export class ZeroQueryZeroError extends Schema.TaggedError<ZeroQueryZeroError>()(
  "ZeroQueryZeroError",
  ZeroQueryErrorData,
) {}

export const ZeroQueryError = Schema.Union(
  ZeroQueryAppError,
  ZeroQueryHttpError,
  ZeroQueryZeroError,
);

export type ZeroQueryError = Schema.Schema.Type<typeof ZeroQueryError>;

export const RawZeroQueryError = Schema.Union(
  Schema.Struct({
    error: Schema.Literal("app"),
    ...ZeroQueryErrorData.fields,
  }),
  Schema.Struct({
    error: Schema.Literal("http"),
    ...ZeroQueryHttpErrorData.fields,
  }),
  Schema.Struct({
    error: Schema.Literal("zero"),
    ...ZeroQueryErrorData.fields,
  }),
);

export type RawZeroQueryError = Schema.Schema.Type<typeof RawZeroQueryError>;
