import { Array, Function, HashMap, Option, pipe, Struct, Record, Tuple } from "effect";

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
  (a: ReadonlyArray<A>): HashMap.HashMap<K, B> =>
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
  <const K extends string | symbol, A extends { [P in K]?: any }, B>({
    key,
    valueInitializer,
    valueReducer,
  }: {
    key: K;
    valueInitializer: (a: A) => B;
    valueReducer: (b: NoInfer<B>, a: NoInfer<A>) => NoInfer<B>;
  }) =>
  (a: ReadonlyArray<A>): HashMap.HashMap<A[K], B> =>
    toHashMap<A, B, A[K]>({
      keyGetter: Struct.get(key),
      valueInitializer: valueInitializer,
      valueReducer: valueReducer,
    })(a);

export const toHashMapByKey =
  <const K extends string | symbol>(key: K) =>
  <A extends { [P in K]?: any }>(a: ReadonlyArray<A>): HashMap.HashMap<A[K], A> =>
    toHashMapByKeyWith<K, A, A>({
      key,
      valueInitializer: Function.identity,
      valueReducer: Function.untupled(Tuple.get(1)),
    })(a);

export const toArrayHashMapByKey =
  <const K extends string | symbol>(key: K) =>
  <A extends { [P in K]?: any }>(
    a: ReadonlyArray<A>,
  ): HashMap.HashMap<A[K], Array.NonEmptyArray<A>> =>
    toHashMapByKeyWith<K, A, Array.NonEmptyArray<A>>({
      key,
      valueInitializer: Array.make,
      valueReducer: Array.append,
    })(a);

type MapStructKeyValues<
  Keys extends Array.NonEmptyReadonlyArray<string | symbol>,
  A extends { [P in Keys[number]]?: any },
> = {
  [K in Keys[number]]: A[K];
} extends infer B
  ? B
  : never;

export const toHashMapByKeysWith =
  <
    const Keys extends Array.NonEmptyReadonlyArray<string | symbol>,
    A extends { [P in Keys[number]]?: any },
    B,
  >({
    keys,
    valueInitializer,
    valueReducer,
  }: {
    keys: Keys;
    valueInitializer: (a: A) => B;
    valueReducer: (b: NoInfer<B>, a: NoInfer<A>) => NoInfer<B>;
  }) =>
  (a: ReadonlyArray<A>): HashMap.HashMap<MapStructKeyValues<Keys, A>, B> =>
    toHashMap<A, B, MapStructKeyValues<Keys, A>>({
      keyGetter: (a) =>
        pipe(
          keys,
          Array.map((key) => [key, pipe(a, Struct.get(key))] as const),
          Record.fromEntries,
        ) as unknown as MapStructKeyValues<Keys, A>,
      valueInitializer: valueInitializer,
      valueReducer: valueReducer,
    })(a);

export const toHashMapByKeys =
  <const Keys extends Array.NonEmptyReadonlyArray<string | symbol>>(keys: Keys) =>
  <A extends { [P in Keys[number]]?: any }>(
    a: ReadonlyArray<A>,
  ): HashMap.HashMap<MapStructKeyValues<Keys, A>, A> =>
    toHashMapByKeysWith<Keys, A, A>({
      keys,
      valueInitializer: Function.identity,
      valueReducer: Function.untupled(Tuple.get(1)),
    })(a);

export const toArrayHashMapByKeys =
  <const Keys extends Array.NonEmptyReadonlyArray<string | symbol>>(keys: Keys) =>
  <A extends { [P in Keys[number]]?: any }>(
    a: ReadonlyArray<A>,
  ): HashMap.HashMap<MapStructKeyValues<Keys, A>, Array.NonEmptyArray<A>> =>
    toHashMapByKeysWith<Keys, A, Array.NonEmptyArray<A>>({
      keys,
      valueInitializer: Array.make,
      valueReducer: Array.append,
    })(a);
