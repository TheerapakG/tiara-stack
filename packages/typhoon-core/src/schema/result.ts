import { Data, Match, Predicate, Schema, pipe, Unify, Either } from "effect";
import { RpcResult } from "./rpc";
import { type RpcError, ValidationError } from "../error";

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

/**
 * Create a new Optimistic result.
 */
export const optimistic = <T>(value: T) => new Optimistic({ value });

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
 * Create a new Complete result.
 */
export const complete = <T>(value: T) => new Complete({ value });

/**
 * Result type for optimistic updates, either Optimistic or Complete.
 */
export type Result<O, C = O> = Optimistic<O> | Complete<C>;

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
export const ResultSchema = <OA, CA, OI, CI, OR, CR>({
  optimistic,
  complete,
}: {
  readonly optimistic: Schema.Schema<OA, OI, OR>;
  readonly complete: Schema.Schema<CA, CI, CR>;
}): Schema.Schema<Result<OA, CA>, Result<OI, CI>, OR | CR> =>
  Schema.Union(OptimisticSchema(optimistic), CompleteSchema(complete));

export const map =
  <OA, CA, B>(f: (a: OA | CA) => B) =>
  (result: Result<OA, CA>): Result<B> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Optimistic: ({ value }) => optimistic(f(value)),
        Complete: ({ value }) => complete(f(value)),
      }),
    );

export const flatmap =
  <OA, CA, OB, CB>(f: (value: OA | CA) => Result<OB, CB>) =>
  (result: Result<OA, CA>): Result<OB | CB, CB> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Optimistic: ({ value }) => optimistic(f(value).value),
        Complete: ({ value }) => f(value),
      }),
    );

export const flaten = <OO, OC, CO, CC>(
  result: Result<Result<OO, OC>, Result<CO, CC>>,
): Result<OO | OC | CO, CC> =>
  pipe(
    Match.value(result),
    Match.tagsExhaustive({
      Optimistic: ({ value }) => optimistic(value.value),
      Complete: ({ value }) => value,
    }),
  );

export const match =
  <OA, OB, CA, CB>(f: {
    onOptimistic: (value: OA) => OB;
    onComplete: (value: CA) => CB;
  }) =>
  (result: Result<OA, CA>): Unify.Unify<OB | CB> =>
    pipe(
      Match.value(result),
      Match.tagsExhaustive({
        Optimistic: ({ value }) => f.onOptimistic(value),
        Complete: ({ value }) => f.onComplete(value),
      }),
    );

export const predicate =
  <O, C>(
    predicate: Predicate.Predicate<O | C>,
  ): Predicate.Predicate<Result<O, C>> =>
  (v: Result<O, C>): boolean =>
    predicate(v.value);

type RefinementResult<O, C, B extends O | C> =
  | (B extends O ? Optimistic<B> : never)
  | (B extends C ? Complete<B> : never);

export const refinement =
  <O, C, B extends O | C>(
    refinement: Predicate.Refinement<O | C, B>,
  ): Predicate.Refinement<Result<O, C>, RefinementResult<O, C, B>> =>
  (v: Result<O, C>): v is RefinementResult<O, C, B> =>
    refinement(v.value);

export const fromRpc =
  <O>(optimisticValue: O) =>
  <A, E>(
    result: RpcResult.RpcResult<A, E>,
  ): Result<O, Either.Either<A, RpcError<E> | ValidationError>> =>
    pipe(
      result,
      RpcResult.match({
        onLoading: () => optimistic(optimisticValue),
        onResolved: (value) => complete(value.value),
      }),
    );

export const isOptimistic = (result: unknown): result is Optimistic<unknown> =>
  result instanceof Optimistic;

export const isComplete = (result: unknown): result is Complete<unknown> =>
  result instanceof Complete;
