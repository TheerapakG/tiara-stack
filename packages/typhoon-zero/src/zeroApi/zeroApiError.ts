import { Schema } from "effect";
import {
  MutatorResultAppError,
  MutatorResultZeroError,
  QueryResultAppError,
  QueryResultParseError,
} from "../error/zeroQueryError";

export {
  MutatorResultAppError,
  MutatorResultZeroError,
  QueryResultAppError,
  QueryResultParseError,
} from "../error/zeroQueryError";

export type QueryError = QueryResultAppError | QueryResultParseError | Schema.SchemaError;

export type MutatorError = MutatorResultAppError | MutatorResultZeroError | Schema.SchemaError;
