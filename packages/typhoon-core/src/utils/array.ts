import { Array, Data, HashMap, Option, Order, pipe } from "effect";

export class ArrayWithDefault<A> extends Data.TaggedClass("ArrayWithDefault")<{
  array: A[];
  default: A;
}> {
  static zip<B>(b: ArrayWithDefault<B>) {
    return <A>(a: ArrayWithDefault<A>) => {
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
  }

  static map<A, B>(mapper: (a: A) => B) {
    return (a: ArrayWithDefault<A>) =>
      new ArrayWithDefault({
        array: Array.map(a.array, mapper),
        default: mapper(a.default),
      });
  }

  static zipMap<A, B>(mapper: (a: A) => B) {
    return (a: ArrayWithDefault<A>) =>
      pipe(a, ArrayWithDefault.zip(ArrayWithDefault.map(mapper)(a)));
  }
}

export const collectArrayToHashMap =
  <A, K>({
    keyGetter,
    keyValueReducer,
  }: {
    keyGetter: (a: A) => K;
    keyValueReducer: (a: A, b: A) => A;
  }) =>
  (a: Array<A>) =>
    Array.reduce(a, HashMap.empty<K, A>(), (acc, v) =>
      HashMap.modifyAt(
        acc,
        keyGetter(v),
        Option.match({
          onSome: (mapValue) => Option.some(keyValueReducer(mapValue, v)),
          onNone: () => Option.some(v),
        }),
      ),
    );
