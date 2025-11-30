import {
  Data,
  Effect,
  Match,
  Predicate,
  Schema,
  pipe,
  Unify,
  Either,
  Option,
  Layer,
  Pretty,
  ParseResult,
  Equivalence,
} from "effect";
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
 * Encoded Optimistic result type.
 */
export type OptimisticEncoded<T> = { readonly _tag: "Optimistic"; value: T };

/**
 * Result type indicating the query value was optimistically resolved from local cache.
 */
export class Optimistic<T> extends OptimisticTaggedClass<T> {}

/**
 * Create a new Optimistic result.
 */
export const optimistic = <T>(value: T) => new Optimistic({ value });

export const getEquivalence = <O, C>({
  optimistic,
  complete,
}: {
  optimistic: Equivalence.Equivalence<O>;
  complete: Equivalence.Equivalence<C>;
}): Equivalence.Equivalence<Result<O, C>> =>
  Equivalence.make((x, y) =>
    isOptimistic(x)
      ? isOptimistic(y) && optimistic(x.value, y.value)
      : isComplete(y) && complete(x.value, y.value),
  );

type CompleteData<T> = {
  readonly value: T;
};
const CompleteTaggedClass: new <T>(
  args: Readonly<CompleteData<T>>,
) => Readonly<CompleteData<T>> & { readonly _tag: "Complete" } =
  Data.TaggedClass("Complete");

/**
 * Encoded Complete result type.
 */
export type CompleteEncoded<T> = { readonly _tag: "Complete"; value: T };

/**
 * Result type indicating the query value was updated from the server.
 */
export class Complete<T> extends CompleteTaggedClass<T> {}

/**
 * Create a new Complete result.
 */
export const complete = <T>(value: T) => new Complete({ value });

/**
 * Encoded Result type.
 */
export type ResultEncoded<O, C> = OptimisticEncoded<O> | CompleteEncoded<C>;

/**
 * Result type for optimistic updates, either Optimistic or Complete.
 */
export type Result<O, C = O> = Optimistic<O> | Complete<C>;

/**
 * Schema for Optimistic Encoded result type.
 */
export const OptimisticEncodedSchema = <O extends Schema.Schema.All>(
  value: O,
) =>
  Schema.Struct({
    _tag: Schema.Literal("Optimistic"),
    value,
  });

const makeOptimisticEncoded = <O>(value: O) =>
  ({ _tag: "Optimistic", value }) as OptimisticEncoded<O>;

/**
 * Schema for Complete Encoded result type.
 */
export const CompleteEncodedSchema = <C extends Schema.Schema.All>(value: C) =>
  Schema.Struct({
    _tag: Schema.Literal("Complete"),
    value,
  });

const makeCompleteEncoded = <C>(value: C) =>
  ({ _tag: "Complete", value }) as CompleteEncoded<C>;

/**
 * Schema for Result Encoded union type.
 */
export const ResultEncodedSchema = <
  O extends Schema.Schema.All,
  C extends Schema.Schema.All,
>({
  optimistic,
  complete,
}: {
  readonly optimistic: O;
  readonly complete: C;
}) =>
  Schema.Union(
    OptimisticEncodedSchema(optimistic),
    CompleteEncodedSchema(complete),
  );

const ResultDecode = <O, C>(input: ResultEncoded<O, C>): Result<O, C> =>
  pipe(
    Match.value(input),
    Match.tagsExhaustive({
      Optimistic: ({ value }) => optimistic(value),
      Complete: ({ value }) => complete(value),
    }),
  );

const ResultPretty =
  <O, C>(optimistic: Pretty.Pretty<O>, complete: Pretty.Pretty<C>) =>
  (input: Result<O, C>): string =>
    pipe(
      input,
      match({
        onOptimistic: (value) => `optimistic(${optimistic(value)})`,
        onComplete: (value) => `complete(${complete(value)})`,
      }),
    );

const ResultParse =
  <OR, O, CR, C>(
    decodeUnknownOptimistic: ParseResult.DecodeUnknown<O, OR>,
    decodeUnknownComplete: ParseResult.DecodeUnknown<C, CR>,
  ): ParseResult.DeclarationDecodeUnknown<Result<O, C>, CR | OR> =>
  (u, options, ast) =>
    u instanceof Optimistic || u instanceof Complete
      ? pipe(
          u,
          match({
            onOptimistic: (value) =>
              pipe(
                decodeUnknownOptimistic(value, options),
                ParseResult.mapBoth({
                  onFailure: (e) => new ParseResult.Composite(ast, u, e),
                  onSuccess: optimistic,
                }),
              ),
            onComplete: (value) =>
              pipe(
                decodeUnknownComplete(value, options),
                ParseResult.mapBoth({
                  onFailure: (e) => new ParseResult.Composite(ast, u, e),
                  onSuccess: complete,
                }),
              ),
          }),
        )
      : ParseResult.fail(new ParseResult.Type(ast, u));

export const ResultFromSelfSchema = <
  O extends Schema.Schema.All,
  C extends Schema.Schema.All,
>({
  optimistic,
  complete,
}: {
  optimistic: O;
  complete: C;
}) =>
  Schema.declare(
    [optimistic, complete],
    {
      decode: (optimistic, complete) =>
        ResultParse(
          ParseResult.decodeUnknown(optimistic),
          ParseResult.decodeUnknown(complete),
        ),
      encode: (optimistic, complete) =>
        ResultParse(
          ParseResult.encodeUnknown(optimistic),
          ParseResult.encodeUnknown(complete),
        ),
    },
    {
      description: `Result<${Schema.format(optimistic)}, ${Schema.format(complete)}>`,
      pretty: ResultPretty,
      equivalence: (optimistic, complete) =>
        getEquivalence({ optimistic, complete }),
    },
  );

export const ResultSchema = <
  O extends Schema.Schema.All,
  C extends Schema.Schema.All,
>({
  optimistic,
  complete,
}: {
  optimistic: O;
  complete: C;
}) => {
  const optimisticSchema = Schema.asSchema(optimistic);
  const completeSchema = Schema.asSchema(complete);

  return pipe(
    ResultEncodedSchema({
      optimistic: optimisticSchema,
      complete: completeSchema,
    }),
    Schema.transform(
      ResultFromSelfSchema({
        optimistic: Schema.typeSchema(optimisticSchema),
        complete: Schema.typeSchema(completeSchema),
      }),
      {
        strict: true,
        decode: ResultDecode<Schema.Schema.Type<O>, Schema.Schema.Type<C>>,
        encode: match({
          onOptimistic: makeOptimisticEncoded,
          onComplete: makeCompleteEncoded,
        }),
      },
    ),
  );
};

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

export const flatten = <OO, OC, CO, CC>(
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

export const fromRpcReturningResult =
  <OV>(optimisticValue: OV) =>
  <O, C, E>(
    result: RpcResult.RpcResult<Result<O, C>, E>,
  ): Result<OV | O, Either.Either<C, RpcError<E> | ValidationError>> =>
    pipe(
      result,
      RpcResult.match({
        onLoading: () => optimistic(optimisticValue),
        onResolved: (value) =>
          pipe(
            value.value,
            Either.match({
              onLeft: (value) => complete(Either.left(value)),
              onRight: match({
                onOptimistic: optimistic,
                onComplete: (value) => complete(Either.right(value)),
              }),
            }),
          ),
      }),
    );

export const isOptimistic = (result: unknown): result is Optimistic<unknown> =>
  result instanceof Optimistic;

export const isComplete = (result: unknown): result is Complete<unknown> =>
  result instanceof Complete;

export const transposeEffect = <A, E, R>(
  result: Result<Effect.Effect<A, E, R>>,
): Effect.Effect<Result<A>, E, R> =>
  pipe(
    result,
    match({
      onOptimistic: Effect.map(optimistic),
      onComplete: Effect.map(complete),
    }),
  );

export const mapEitherOption =
  <T, B>(f: (value: T) => B) =>
  <E>(
    result: Result<Either.Either<Option.Option<T>, E>>,
  ): Result<Either.Either<Option.Option<B>, E>> =>
    pipe(result, map(Either.map(Option.map(f))));

export const someOrLeft =
  <E>(onNone: () => E) =>
  <T>(result: Result<Option.Option<T>>): Result<Either.Either<T, E>> =>
    pipe(
      result,
      map(Either.liftPredicate(Option.isSome, onNone)),
      map(Either.map((option) => option.value)),
    );

export const eitherSomeOrLeft =
  <E1>(onNone: () => E1) =>
  <T, E2>(
    result: Result<Either.Either<Option.Option<T>, E2>>,
  ): Result<Either.Either<T, E1 | E2>> =>
    pipe(
      result,
      map(Either.filterOrLeft(Option.isSome, onNone)),
      map(Either.map((option) => option.value)),
    );

export const provideEitherLayer =
  <ROut, E1, RIn, E2>(
    layer: Result<Either.Either<Layer.Layer<ROut, E1, RIn>, E2>>,
  ) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<
    Result<Either.Either<A, E | E1 | E2>>,
    never,
    Exclude<R, ROut> | RIn
  > =>
    pipe(
      layer,
      map(Either.map((layer) => pipe(effect, Effect.provide(layer)))),
      map(Effect.flatten),
      map(Effect.either),
      transposeEffect,
    );
