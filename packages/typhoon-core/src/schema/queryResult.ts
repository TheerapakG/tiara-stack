import { Data, Match, Predicate, Schema, pipe, Unify } from "effect";

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

const mapResult =
  <A, B>(f: (a: A) => B) =>
  (result: Result<A>): Result<B> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Optimistic: ({ value }) => new Optimistic({ value: f(value) }),
        Complete: ({ value }) => new Complete({ value: f(value) }),
      }),
    );

const matchResult =
  <A, B, C>(f: {
    onOptimistic: (value: A) => B;
    onComplete: (value: A) => C;
  }) =>
  (result: Result<A>): Unify.Unify<B | C> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Optimistic: ({ value }) => f.onOptimistic(value),
        Complete: ({ value }) => f.onComplete(value),
      }),
    );

const predicateResult =
  <A>(predicate: Predicate.Predicate<A>): Predicate.Predicate<Result<A>> =>
  (v: Result<A>): boolean =>
    predicate(v.value);

const refinementResult =
  <A, B extends A>(
    refinement: Predicate.Refinement<A, B>,
  ): Predicate.Refinement<Result<A>, Result<B>> =>
  (v: Result<A>): v is Result<B> =>
    refinement(v.value);

export const Result = {
  map: mapResult,
  match: matchResult,
  predicate: predicateResult,
  refinement: refinementResult,
};
