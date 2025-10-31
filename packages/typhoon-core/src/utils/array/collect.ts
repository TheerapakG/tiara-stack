import { Array, Function, HashMap, Option, Struct, Tuple, Types } from "effect";

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
  (a: ReadonlyArray<A>) =>
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

export const toHashMapByKeyWith =
  <K extends PropertyKey, A extends { [P in K]?: any }, B>({
    key,
    valueInitializer,
    valueReducer,
  }: {
    key: K;
    valueInitializer: (a: A) => B;
    valueReducer: (b: NoInfer<B>, a: NoInfer<A>) => NoInfer<B>;
  }) =>
  (a: ReadonlyArray<A>) =>
    toHashMap<A, B, Types.MatchRecord<A, A[K] | undefined, A[K]>>({
      keyGetter: Struct.get(key),
      valueInitializer: valueInitializer,
      valueReducer: valueReducer,
    })(a);

export const toHashMapByKey =
  <K extends PropertyKey>(key: K) =>
  <A extends { [P in K]?: any }>(a: ReadonlyArray<A>) =>
    toHashMapByKeyWith<K, A, A>({
      key,
      valueInitializer: Function.identity,
      valueReducer: Function.untupled(Tuple.getSecond),
    })(a);

export const toArrayHashMapByKey =
  <K extends PropertyKey>(key: K) =>
  <A extends { [P in K]?: any }>(a: ReadonlyArray<A>) =>
    toHashMapByKeyWith<K, A, Array.NonEmptyArray<A>>({
      key,
      valueInitializer: Array.make,
      valueReducer: Array.append,
    })(a);
