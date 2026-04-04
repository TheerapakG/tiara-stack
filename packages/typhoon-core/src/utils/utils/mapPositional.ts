import { Array, Effect, HashMap, Option, Struct, pipe, Tuple, Record } from "effect";

export const hashMapPositional =
  <In, Out, E, R>(f: (a: ReadonlyArray<In>) => Effect.Effect<ReadonlyArray<Out>, E, R>) =>
  <T extends HashMap.HashMap<unknown, In>>(
    map: T,
  ): Effect.Effect<HashMap.HashMap<HashMap.HashMap.Key<T>, Out>, E, R> =>
    pipe(
      Effect.Do,
      Effect.let("entries", () => HashMap.toEntries(map)),
      Effect.let("keys", ({ entries }) => pipe(entries, Array.map(Tuple.get(0)))),
      Effect.let("values", ({ entries }) => pipe(entries, Array.map(Tuple.get(1)))),
      Effect.bind("resultValues", ({ values }) => f(values)),
      Effect.map(
        ({ keys, resultValues }) =>
          pipe(Array.zip(keys, resultValues), HashMap.fromIterable) as HashMap.HashMap<
            HashMap.HashMap.Key<T>,
            Out
          >,
      ),
    );

export const mapPositional =
  <In, Out, E, R>(f: (a: ReadonlyArray<In>) => Effect.Effect<ReadonlyArray<Out>, E, R>) =>
  <T extends Record<string, In>>(map: T): Effect.Effect<Record<keyof T, Out>, E, R> =>
    pipe(
      Effect.Do,
      Effect.let("entries", () => Record.toEntries(map)),
      Effect.let(
        "keys",
        ({ entries }) =>
          pipe(entries, Array.map(Tuple.get(0))) as Array<keyof T & (string | symbol)>,
      ),
      Effect.let("values", ({ entries }) => pipe(entries, Array.map(Tuple.get(1)))),
      Effect.bind("resultValues", ({ values }) => f(values)),
      Effect.map(
        ({ keys, resultValues }) =>
          pipe(Array.zip(keys, resultValues), Record.fromEntries) as Record<keyof T, Out>,
      ),
    );

export const arraySomesPositional =
  <In, Out, E, R>(f: (a: ReadonlyArray<In>) => Effect.Effect<ReadonlyArray<Out>, E, R>) =>
  (
    array: ReadonlyArray<Option.Option<In>>,
  ): Effect.Effect<ReadonlyArray<Option.Option<Out>>, E, R> =>
    pipe(
      Effect.Do,
      Effect.let("values", () => pipe(array, Array.getSomes)),
      Effect.bind("resultValues", ({ values }) => f(values)),
      Effect.map(({ resultValues }) =>
        pipe(
          array,
          Array.reduce(
            { resultIndex: 0, result: [] as Option.Option<Out>[] },
            ({ resultIndex, result }, value) => ({
              resultIndex: Option.isSome(value) ? resultIndex + 1 : resultIndex,
              result: Array.append(
                result,
                pipe(
                  value,
                  Option.flatMap(() => Array.get(resultValues, resultIndex)),
                ),
              ),
            }),
          ),
        ),
      ),
      Effect.map(({ result }) => result),
    );

export const keyPositional =
  <In extends object, Out, E, R, const Key extends keyof In>(
    key: Key,
    f: (a: ReadonlyArray<In[Key]>) => Effect.Effect<ReadonlyArray<Out>, E, R>,
  ) =>
  (
    array: ReadonlyArray<In>,
  ): Effect.Effect<ReadonlyArray<Omit<In, Key> & { [K in Key]: Out }>, E, R> =>
    pipe(
      Effect.Do,
      Effect.let("values", () => pipe(array, Array.map(Struct.get(key)))),
      Effect.bind("resultValues", ({ values }) => f(values)),
      Effect.map(({ resultValues }) =>
        pipe(
          Array.zip(array, resultValues),
          Array.map(([value, resultValue]) => ({
            ...value,
            [key]: resultValue,
          })),
        ),
      ),
    );
