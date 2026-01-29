import {
  Context,
  Deferred,
  Effect,
  Exit,
  Function,
  MutableHashMap,
  MutableRef,
  Option,
  Scope,
  Types,
  pipe,
} from "effect";

const ScopedCacheTypeId = Symbol.for("typhoon/ScopedCache");

export type ScopedCacheTypeId = typeof ScopedCacheTypeId;

export interface Variance<in Key, out Value, out Error = never> {
  readonly [ScopedCacheTypeId]: {
    readonly _Key: Types.Contravariant<Key>;
    readonly _Value: Types.Covariant<Value>;
    readonly _Error: Types.Covariant<Error>;
  };
}

const scopedCacheVariance: <Key, Value, Error = never>() => Variance<
  Key,
  Value,
  Error
>[ScopedCacheTypeId] = () => ({
  _Key: Function.identity,
  _Value: Function.identity,
  _Error: Function.identity,
});

export interface ScopedCache<in Key, out Value, out Error = never> extends Variance<
  Key,
  Value,
  Error
> {
  get(key: Key): Effect.Effect<Value, Error, Scope.Scope>;
}

interface CachedEntry<Key, Value, Error> {
  readonly key: Key;
  readonly exit: Exit.Exit<Value, Error>;
  readonly finalizer: () => Effect.Effect<void, never, never>;
  readonly ownerCount: MutableRef.MutableRef<number>;
}

class ScopedCacheImpl<Key, Value, Error, Environment> implements ScopedCache<Key, Value, Error> {
  readonly [ScopedCacheTypeId] = scopedCacheVariance<Key, Value, Error>();

  private readonly cache: MutableHashMap.MutableHashMap<
    Key,
    Deferred.Deferred<CachedEntry<Key, Value, Error>, never>
  > = MutableHashMap.empty();

  constructor(
    readonly lookup: (key: Key) => Effect.Effect<Value, Error, Environment | Scope.Scope>,
    readonly context: Context.Context<Environment>,
  ) {}

  get(key: Key): Effect.Effect<Value, Error, Scope.Scope> {
    return pipe(
      Effect.sync(() => MutableHashMap.get(this.cache, key)),
      Effect.flatMap(
        Option.match({
          onSome: Effect.succeed,
          onNone: () => this.startComputation(key),
        }),
      ),
      Effect.flatMap((deferred) => this.useEntry(deferred)),
    );
  }

  private useEntry(
    deferred: Deferred.Deferred<CachedEntry<Key, Value, Error>, never>,
  ): Effect.Effect<Value, Error, Scope.Scope> {
    return pipe(
      Deferred.await(deferred),
      Effect.flatMap((cachedEntry) =>
        Effect.acquireRelease(
          pipe(
            Effect.sync(() => MutableRef.incrementAndGet(cachedEntry.ownerCount)),
            Effect.flatMap(() => cachedEntry.exit),
          ),
          () =>
            pipe(
              Effect.sync(() => MutableRef.decrementAndGet(cachedEntry.ownerCount)),
              Effect.flatMap((count) =>
                pipe(
                  cachedEntry.finalizer(),
                  Effect.andThen(() =>
                    Effect.sync(() => MutableHashMap.remove(this.cache, cachedEntry.key)),
                  ),
                  Effect.when(() => count === 0),
                ),
              ),
            ),
        ),
      ),
    );
  }

  private startComputation(
    key: Key,
  ): Effect.Effect<Deferred.Deferred<CachedEntry<Key, Value, Error>, never>, never, Scope.Scope> {
    return pipe(
      Deferred.make<CachedEntry<Key, Value, Error>, never>(),
      Effect.tap((deferred) =>
        pipe(
          Effect.sync(() => MutableHashMap.set(this.cache, key, deferred)),
          Effect.tap(() => Deferred.complete(deferred, this.computeEntry(key))),
          Effect.onInterrupt(() => Effect.sync(() => MutableHashMap.remove(this.cache, key))),
        ),
      ),
    );
  }

  private computeEntry(key: Key): Effect.Effect<CachedEntry<Key, Value, Error>, never> {
    return pipe(
      Effect.Do,
      Effect.bind("innerScope", () => Scope.make()),
      Effect.bind("exit", ({ innerScope }) =>
        pipe(this.lookup(key), Effect.provide(this.context), Scope.extend(innerScope), Effect.exit),
      ),
      Effect.map(({ exit, innerScope }) => ({
        key,
        exit,
        finalizer: () => Scope.close(innerScope, exit),
        ownerCount: MutableRef.make(0),
      })),
    );
  }
}

export type Lookup<Key, Value, Error = never, Environment = never> = (
  key: Key,
) => Effect.Effect<Value, Error, Environment | Scope.Scope>;

export const make = <Key, Value, Error = never, Environment = never>(options: {
  readonly lookup: Lookup<Key, Value, Error, Environment>;
}): Effect.Effect<ScopedCache<Key, Value, Error>, never, Environment> =>
  pipe(
    Effect.context<Environment>(),
    Effect.map((context) => new ScopedCacheImpl(options.lookup, context)),
  );
