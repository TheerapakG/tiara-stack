import { Schema } from "effect";
import type { ReadonlyJSONValue } from "@rocicorp/zero";

export const ReadonlyJSONValueSchema: Schema.Schema<ReadonlyJSONValue> = Schema.Union(
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
  message: Schema.optional(Schema.String),
  details: Schema.optional(ReadonlyJSONValueSchema),
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

export class ZeroQueryParseError extends Schema.TaggedError<ZeroQueryParseError>()(
  "ZeroQueryParseError",
  ZeroQueryErrorData,
) {}

export const ZeroQueryError = Schema.Union(
  ZeroQueryAppError,
  ZeroQueryHttpError,
  ZeroQueryZeroError,
  ZeroQueryParseError,
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
  Schema.Struct({
    error: Schema.Literal("parse"),
    ...ZeroQueryErrorData.fields,
  }),
);

export type RawZeroQueryError = Schema.Schema.Type<typeof RawZeroQueryError>;

export class QueryResultAppError extends Schema.TaggedError<QueryResultAppError>()(
  "QueryResultAppError",
  Schema.Struct({
    error: Schema.Literal("app"),
    id: Schema.String,
    name: Schema.String,
    message: Schema.optional(Schema.String),
    details: Schema.optional(ReadonlyJSONValueSchema),
  }),
) {}

export class QueryResultParseError extends Schema.TaggedError<QueryResultParseError>()(
  "QueryResultParseError",
  Schema.Struct({
    error: Schema.Literal("parse"),
    id: Schema.String,
    name: Schema.String,
    message: Schema.optional(Schema.String),
    details: Schema.optional(ReadonlyJSONValueSchema),
  }),
) {}

export const QueryResultError = Schema.Union(QueryResultAppError, QueryResultParseError);

export type QueryResultError = Schema.Schema.Type<typeof QueryResultError>;

export class MutatorResultAppError extends Schema.TaggedError<MutatorResultAppError>()(
  "MutatorResultAppError",
  Schema.Struct({
    type: Schema.Literal("app"),
    message: Schema.String,
    details: Schema.optional(ReadonlyJSONValueSchema),
  }),
) {}

export class MutatorResultZeroError extends Schema.TaggedError<MutatorResultZeroError>()(
  "MutatorResultZeroError",
  Schema.Struct({
    type: Schema.Literal("zero"),
    message: Schema.String,
  }),
) {}

export const MutatorResultError = Schema.Union(MutatorResultAppError, MutatorResultZeroError);

export type MutatorResultError = Schema.Schema.Type<typeof MutatorResultError>;
