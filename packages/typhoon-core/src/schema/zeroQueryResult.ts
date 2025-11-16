import { Schema } from "effect";

/**
 * Result type indicating the query value was optimistically resolved from local cache.
 */
export type Optimistic<T> = {
  readonly _tag: "Optimistic";
  readonly value: T;
};

/**
 * Result type indicating the query value was updated from the server.
 */
export type Complete<T> = {
  readonly _tag: "Complete";
  readonly value: T;
};

/**
 * Result type for Zero query values, either Optimistic or Complete.
 */
export type ZeroQueryResult<T> = Optimistic<T> | Complete<T>;

/**
 * Schema for Optimistic result type.
 */
export const Optimistic = <A, I = A, R = never>(
  value: Schema.Schema<A, I, R>,
): Schema.Schema<Optimistic<A>, Optimistic<I>, R> =>
  Schema.Struct({
    _tag: Schema.Literal("Optimistic"),
    value,
  });

/**
 * Schema for Complete result type.
 */
export const Complete = <A, I = A, R = never>(
  value: Schema.Schema<A, I, R>,
): Schema.Schema<Complete<A>, Complete<I>, R> =>
  Schema.Struct({
    _tag: Schema.Literal("Complete"),
    value,
  });

/**
 * Schema for ZeroQueryResult union type.
 */
export const ZeroQueryResult = <A, I = A, R = never>(
  value: Schema.Schema<A, I, R>,
): Schema.Schema<ZeroQueryResult<A>, ZeroQueryResult<I>, R> =>
  Schema.Union(Optimistic(value), Complete(value));
