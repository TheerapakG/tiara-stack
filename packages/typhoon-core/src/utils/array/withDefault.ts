import { Array, Data, Either, Option, Order, pipe } from "effect";

type ArrayWithDefaultData<S extends ReadonlyArray<unknown>> = {
  array: S;
  default: () => Array.ReadonlyArray.Infer<S>;
};
const ArrayWithDefaultTaggedClass: new <S extends ReadonlyArray<unknown>>(
  args: Readonly<ArrayWithDefaultData<S>>,
) => Readonly<ArrayWithDefaultData<S>> & {
  readonly _tag: "ArrayWithDefault";
} = Data.TaggedClass("ArrayWithDefault");
export class ArrayWithDefault<
  const S extends ReadonlyArray<unknown>,
> extends ArrayWithDefaultTaggedClass<S> {}

export const wrap =
  <S extends ReadonlyArray<unknown>>(options: {
    default: () => Array.ReadonlyArray.Infer<S>;
  }) =>
  (array: S) =>
    new ArrayWithDefault({
      array,
      default: options.default,
    });

export const wrapEither =
  <S extends ReadonlyArray<Either.Either<unknown, unknown>>>(options: {
    default: () => Either.Either.Right<Array.ReadonlyArray.Infer<S>>;
  }) =>
  (array: S) =>
    new ArrayWithDefault({
      array: pipe(
        array as ReadonlyArray<
          Either.Either<
            Either.Either.Right<Array.ReadonlyArray.Infer<S>>,
            unknown
          >
        >,
        Array.map(Either.getOrElse(options.default)),
      ),
      default: options.default,
    });

export const wrapOption =
  <S extends ReadonlyArray<Option.Option<unknown>>>(options: {
    default: () => Option.Option.Value<Array.ReadonlyArray.Infer<S>>;
  }) =>
  (array: S) =>
    new ArrayWithDefault({
      array: pipe(
        array as ReadonlyArray<
          Option.Option<Option.Option.Value<Array.ReadonlyArray.Infer<S>>>
        >,
        Array.map(Option.getOrElse(options.default)),
      ),
      default: options.default,
    });

export type InferArray<A extends ArrayWithDefault<ReadonlyArray<unknown>>> =
  A extends ArrayWithDefault<infer S> ? S : never;
export type Infer<A extends ArrayWithDefault<ReadonlyArray<unknown>>> =
  Array.ReadonlyArray.Infer<InferArray<A>>;

export const toArray = <S extends ArrayWithDefault<ReadonlyArray<unknown>>>(
  a: S,
) => a.array as InferArray<S>;
export const getDefault = <S extends ArrayWithDefault<ReadonlyArray<unknown>>>(
  a: S,
) => a.default() as Infer<S>;

export const zip =
  <T extends ArrayWithDefault<ReadonlyArray<object>>>(b: T) =>
  <S extends ArrayWithDefault<ReadonlyArray<object>>>(a: S) => {
    const arrayA = toArray(a);
    const arrayB = toArray(b);

    const maxLength = Order.max(Order.number)(
      Array.length(arrayA),
      Array.length(arrayB),
    );

    return new ArrayWithDefault({
      array: pipe(
        Array.zip(
          Array.appendAll(
            Array.copy(arrayA),
            Array.makeBy(maxLength - Array.length(arrayA), () => getDefault(a)),
          ),
          Array.appendAll(
            Array.copy(arrayB),
            Array.makeBy(maxLength - Array.length(arrayB), () => getDefault(b)),
          ),
        ),
        Array.map(([a, b]) => ({ ...a, ...b }) as Infer<S> & Infer<T>),
      ),
      default: () => ({ ...getDefault(a), ...getDefault(b) }),
    });
  };

export const zipArray =
  <T extends ArrayWithDefault<ReadonlyArray<ReadonlyArray<unknown>>>>(b: T) =>
  <S extends ArrayWithDefault<ReadonlyArray<ReadonlyArray<unknown>>>>(a: S) => {
    const arrayA = toArray(a);
    const arrayB = toArray(b);

    const maxLength = Order.max(Order.number)(
      Array.length(arrayA),
      Array.length(arrayB),
    );

    return new ArrayWithDefault({
      array: pipe(
        Array.zip(
          Array.appendAll(
            Array.copy(arrayA),
            Array.makeBy(maxLength - Array.length(arrayA), () => getDefault(a)),
          ),
          Array.appendAll(
            Array.copy(arrayB),
            Array.makeBy(maxLength - Array.length(arrayB), () => getDefault(b)),
          ),
        ),
        Array.map(([a, b]) => [...a, ...b] as [...Infer<S>, ...Infer<T>]),
      ),
      default: () =>
        [...getDefault(a), ...getDefault(b)] as [...Infer<S>, ...Infer<T>],
    });
  };

export const map =
  <S extends ArrayWithDefault<ReadonlyArray<unknown>>, B>(
    mapper: (a: Infer<S>) => B,
  ) =>
  (a: S) =>
    new ArrayWithDefault({
      array: Array.map(toArray(a), mapper),
      default: () =>
        mapper(getDefault(a)) as Array.ReadonlyArray.Infer<
          Array.ReadonlyArray.With<InferArray<S>, B>
        >,
    });

export const zipMap =
  <S extends ArrayWithDefault<ReadonlyArray<object>>, B extends object>(
    mapper: (a: Infer<S>) => B,
  ) =>
  (a: S) =>
    pipe(a, zip(pipe(a, map(mapper))));

export const zipMapArray =
  <
    S extends ArrayWithDefault<ReadonlyArray<unknown[]>>,
    B extends ReadonlyArray<unknown>,
  >(
    mapper: (a: Infer<S>) => B,
  ) =>
  (a: S) =>
    pipe(a, zipArray(pipe(a, map(mapper))));
