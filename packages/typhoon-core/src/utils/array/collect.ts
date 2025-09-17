import { Array, HashMap, Option } from "effect";

export const toHashMap =
  <A, B, K>({
    keyGetter,
    valueInitializer,
    valueReducer,
  }: {
    keyGetter: (a: A) => K;
    valueInitializer: (a: A) => B;
    valueReducer: (b: NoInfer<B>, a: NoInfer<A>) => NoInfer<B>;
  }) =>
  (a: Array<A>) =>
    Array.reduce(a, HashMap.empty<K, B>(), (acc, v) =>
      HashMap.modifyAt(
        acc,
        keyGetter(v),
        Option.match({
          onSome: (mapValue) => Option.some(valueReducer(mapValue, v)),
          onNone: () => Option.some(valueInitializer(v)),
        }),
      ),
    );
