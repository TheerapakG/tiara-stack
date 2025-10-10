import { Array, Data, Order, pipe } from "effect";

export class ArrayWithDefault<
  S extends ReadonlyArray<object>,
> extends Data.TaggedClass("ArrayWithDefault")<{
  array: S;
  default: Array.ReadonlyArray.Infer<S>;
}> {}

export const wrap =
  <S extends ReadonlyArray<object>>(options: {
    default: Array.ReadonlyArray.Infer<S>;
  }) =>
  (array: S) =>
    new ArrayWithDefault({
      array,
      default: options.default,
    });

export type InferArray<A extends ArrayWithDefault<ReadonlyArray<object>>> =
  A extends ArrayWithDefault<infer S> ? S : never;
export type Infer<A extends ArrayWithDefault<ReadonlyArray<object>>> =
  Array.ReadonlyArray.Infer<InferArray<A>>;

export const toArray = <S extends ArrayWithDefault<ReadonlyArray<object>>>(
  a: S,
) => a.array as InferArray<S>;
export const getDefault = <S extends ArrayWithDefault<ReadonlyArray<object>>>(
  a: S,
) => a.default as Infer<S>;

export const zip =
  <T extends ArrayWithDefault<ReadonlyArray<object>>>(b: T) =>
  <S extends ArrayWithDefault<ReadonlyArray<object>>>(a: S) => {
    const maxLength = Order.max(Order.number)(
      Array.length(toArray(a)),
      Array.length(toArray(b)),
    );

    return new ArrayWithDefault({
      array: pipe(
        Array.zip(
          Array.pad(Array.copy(toArray(a)), maxLength, a.default),
          Array.pad(Array.copy(toArray(b)), maxLength, b.default),
        ),
        Array.map(([a, b]) => ({ ...a, ...b }) as Infer<S> & Infer<T>),
      ),
      default: { ...getDefault(a), ...getDefault(b) },
    });
  };

export const map =
  <S extends ArrayWithDefault<ReadonlyArray<object>>, B extends object>(
    mapper: (a: Infer<S>) => B,
  ) =>
  (a: S) =>
    new ArrayWithDefault({
      array: Array.map(toArray(a), mapper),
      default: mapper(getDefault(a)) as Array.ReadonlyArray.Infer<
        Array.ReadonlyArray.With<InferArray<S>, B>
      >,
    });

export const zipMap =
  <S extends ArrayWithDefault<ReadonlyArray<object>>, B extends object>(
    mapper: (a: Infer<S>) => B,
  ) =>
  (a: S) =>
    pipe(a, zip(pipe(a, map(mapper))));
