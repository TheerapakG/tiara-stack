import { Array, Effect, HashMap, Struct, pipe, Tuple } from "effect";

export const HashMapPositional =
  <In, Out, E, R>(
    f: (a: ReadonlyArray<In>) => Effect.Effect<ReadonlyArray<Out>, E, R>,
  ) =>
  <T extends HashMap.HashMap<unknown, In>>(
    map: T,
  ): Effect.Effect<HashMap.HashMap<HashMap.HashMap.Key<T>, Out>, E, R> =>
    pipe(
      Effect.Do,
      Effect.let("entries", () => HashMap.toEntries(map)),
      Effect.let("keys", ({ entries }) =>
        pipe(entries, Array.map(Tuple.getFirst)),
      ),
      Effect.let("values", ({ entries }) =>
        pipe(entries, Array.map(Tuple.getSecond)),
      ),
      Effect.bind("resultValues", ({ values }) => f(values)),
      Effect.map(
        ({ keys, resultValues }) =>
          pipe(
            Array.zip(keys, resultValues),
            HashMap.fromIterable,
          ) as HashMap.HashMap<HashMap.HashMap.Key<T>, Out>,
      ),
    );

export const mapPositional =
  <In, Out, E, R>(
    f: (a: ReadonlyArray<In>) => Effect.Effect<ReadonlyArray<Out>, E, R>,
  ) =>
  <T extends Record<string, In>>(
    map: T,
  ): Effect.Effect<Record<keyof T, Out>, E, R> =>
    pipe(
      Effect.Do,
      Effect.let("entries", () => Struct.entries(map)),
      Effect.let("keys", ({ entries }) =>
        pipe(entries, Array.map(Tuple.getFirst)),
      ),
      Effect.let("values", ({ entries }) =>
        pipe(entries, Array.map(Tuple.getSecond)),
      ),
      Effect.bind("resultValues", ({ values }) => f(values)),
      Effect.map(({ keys, resultValues }) =>
        pipe(Array.zip(keys, resultValues), Object.fromEntries),
      ),
    );
