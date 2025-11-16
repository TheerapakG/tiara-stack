import { Data, Schema } from "effect";

type OptimisticData<T> = {
  readonly value: T;
};
const OptimisticTaggedClass: new <T>(
  args: Readonly<OptimisticData<T>>,
) => Readonly<OptimisticData<T>> & { readonly _tag: "Optimistic" } =
  Data.TaggedClass("Optimistic");

/**
 * Result type indicating the query value was optimistically resolved from local cache.
 */
export class Optimistic<T> extends OptimisticTaggedClass<T> {}

type CompleteData<T> = {
  readonly value: T;
};
const CompleteTaggedClass: new <T>(
  args: Readonly<CompleteData<T>>,
) => Readonly<CompleteData<T>> & { readonly _tag: "Complete" } =
  Data.TaggedClass("Complete");

/**
 * Result type indicating the query value was updated from the server.
 */
export class Complete<T> extends CompleteTaggedClass<T> {}

/**
 * Result type for optimistic updates, either Optimistic or Complete.
 */
export type Result<T> = Optimistic<T> | Complete<T>;

/**
 * Schema for Optimistic result type.
 */
export const OptimisticSchema = <A, I = A, R = never>(
  value: Schema.Schema<A, I, R>,
): Schema.Schema<Optimistic<A>, Optimistic<I>, R> =>
  Schema.Struct({
    _tag: Schema.Literal("Optimistic"),
    value,
  });

/**
 * Schema for Complete result type.
 */
export const CompleteSchema = <A, I = A, R = never>(
  value: Schema.Schema<A, I, R>,
): Schema.Schema<Complete<A>, Complete<I>, R> =>
  Schema.Struct({
    _tag: Schema.Literal("Complete"),
    value,
  });

/**
 * Schema for Result union type.
 */
export const ResultSchema = <A, I = A, R = never>(
  value: Schema.Schema<A, I, R>,
): Schema.Schema<Result<A>, Result<I>, R> =>
  Schema.Union(OptimisticSchema(value), CompleteSchema(value));
