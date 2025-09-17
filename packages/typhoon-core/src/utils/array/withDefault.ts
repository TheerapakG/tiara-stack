import { Array, Data, Order, pipe } from "effect";

export class ArrayWithDefault<A> extends Data.TaggedClass("ArrayWithDefault")<{
  array: A[];
  default: A;
}> {}

export const zip =
  <B>(b: ArrayWithDefault<B>) =>
  <A>(a: ArrayWithDefault<A>) => {
    const maxLength = Order.max(Order.number)(
      Array.length(a.array),
      Array.length(b.array),
    );

    return new ArrayWithDefault({
      array: pipe(
        Array.zip(
          Array.pad(a.array, maxLength, a.default),
          Array.pad(b.array, maxLength, b.default),
        ),
        Array.map(([a, b]) => ({ ...a, ...b })),
      ),
      default: { ...a.default, ...b.default },
    });
  };

export const map =
  <A, B>(mapper: (a: A) => B) =>
  (a: ArrayWithDefault<A>) =>
    new ArrayWithDefault({
      array: Array.map(a.array, mapper),
      default: mapper(a.default),
    });

export const zipMap =
  <A, B>(mapper: (a: A) => B) =>
  (a: ArrayWithDefault<A>) =>
    pipe(a, zip(map(mapper)(a)));
