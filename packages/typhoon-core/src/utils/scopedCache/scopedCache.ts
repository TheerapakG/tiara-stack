import {
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

export interface Variance<in Key, out Value, out Error, out Environment> {
  readonly [ScopedCacheTypeId]: {
    readonly _Key: Types.Contravariant<Key>;
    readonly _Value: Types.Covariant<Value>;
    readonly _Error: Types.Covariant<Error>;
    readonly _Environment: Types.Covariant<Environment>;
  };
}

const scopedCacheVariance: <Key, Value, Error, Environment>() => Variance<
  Key,
  Value,
  Error,
  Environment
>[ScopedCacheTypeId] = () => ({
  _Key: Function.identity,
  _Value: Function.identity,
  _Error: Function.identity,
  _Environment: Function.identity,
});

export interface ScopedCache<in Key, out Value, out Error, out Environment> extends Variance<
  Key,
  Value,
  Error,
  Environment
> {
  get(key: Key): Effect.Effect<Value, Error, Environment | Scope.Scope>;
}

interface CachedEntry<Key, Value, Error> {
  readonly key: Key;
  readonly exit: Exit.Exit<Value, Error>;
  readonly finalizer: () => Effect.Effect<void, never, never>;
  readonly ownerCount: MutableRef.MutableRef<number>;
}

let globalCacheId = 0;

class ScopedCacheImpl<Key, Value, Error, Environment> implements ScopedCache<
  Key,
  Value,
  Error,
  Environment
> {
  readonly [ScopedCacheTypeId] = scopedCacheVariance<Key, Value, Error, Environment>();
  readonly cacheId = ++globalCacheId;

  private readonly cache: MutableHashMap.MutableHashMap<
    Key,
    Deferred.Deferred<CachedEntry<Key, Value, Error>, never>
  > = MutableHashMap.empty();

  constructor(
    readonly lookup: (key: Key) => Effect.Effect<Value, Error, Environment | Scope.Scope>,
  ) {
    console.log(`[ScopedCache #${this.cacheId}] Created`);
  }

  get(key: Key): Effect.Effect<Value, Error, Environment | Scope.Scope> {
    console.log(
      `[ScopedCache #${this.cacheId}] get(${String(key)}) called, cache size: ${MutableHashMap.size(this.cache)}`,
    );
    return pipe(
      Effect.sync(() => MutableHashMap.get(this.cache, key)),
      Effect.flatMap(
        Option.match({
          onSome: (deferred) => {
            console.log(`[ScopedCache #${this.cacheId}] Cache HIT for ${String(key)}`);
            return Effect.succeed(deferred);
          },
          onNone: () => {
            console.log(`[ScopedCache #${this.cacheId}] Cache MISS for ${String(key)}`);
            return this.startComputation(key);
          },
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
      Effect.flatMap((cachedEntry) => {
        const ownerCountBefore = MutableRef.get(cachedEntry.ownerCount);
        console.log(
          `[ScopedCache #${this.cacheId}] useEntry for ${String(cachedEntry.key)}, ownerCount before: ${ownerCountBefore}`,
        );
        return Effect.acquireRelease(
          pipe(
            Effect.sync(() => MutableRef.incrementAndGet(cachedEntry.ownerCount)),
            Effect.flatMap(() => cachedEntry.exit),
          ),
          () => {
            const newCount = MutableRef.decrementAndGet(cachedEntry.ownerCount);
            console.log(
              `[ScopedCache #${this.cacheId}] Release finalizer for ${String(cachedEntry.key)}, ownerCount after: ${newCount}`,
            );
            return pipe(
              Effect.sync(() => newCount),
              Effect.flatMap((count) =>
                pipe(
                  cachedEntry.finalizer(),
                  Effect.andThen(() =>
                    Effect.sync(() => {
                      console.log(
                        `[ScopedCache #${this.cacheId}] Removing ${String(cachedEntry.key)} from cache`,
                      );
                      MutableHashMap.remove(this.cache, cachedEntry.key);
                    }),
                  ),
                  Effect.when(Effect.succeed(count === 0)),
                ),
              ),
            );
          },
        );
      }),
    );
  }

  private startComputation(
    key: Key,
  ): Effect.Effect<
    Deferred.Deferred<CachedEntry<Key, Value, Error>, never>,
    never,
    Environment | Scope.Scope
  > {
    console.log(`[ScopedCache #${this.cacheId}] startComputation for ${String(key)}`);
    return pipe(
      Deferred.make<CachedEntry<Key, Value, Error>, never>(),
      Effect.tap((deferred) =>
        pipe(
          Effect.sync(() => {
            console.log(
              `[ScopedCache #${this.cacheId}] Setting deferred in cache for ${String(key)}`,
            );
            MutableHashMap.set(this.cache, key, deferred);
          }),
          Effect.tap(() =>
            Effect.uninterruptibleMask((restore) =>
              Effect.flatMap(Effect.exit(restore(this.computeEntry(key))), (exit) => {
                console.log(
                  `[ScopedCache #${this.cacheId}] computeEntry done for ${String(key)}, exit:`,
                  exit._tag,
                );
                return Deferred.done(deferred, exit);
              }),
            ),
          ),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              console.log(
                `[ScopedCache #${this.cacheId}] Interrupted, removing ${String(key)} from cache`,
              );
              MutableHashMap.remove(this.cache, key);
            }),
          ),
        ),
      ),
    );
  }

  private computeEntry(
    key: Key,
  ): Effect.Effect<CachedEntry<Key, Value, Error>, never, Environment> {
    console.log(`[ScopedCache #${this.cacheId}] computeEntry for ${String(key)}`);
    return pipe(
      Effect.Do,
      Effect.bind("innerScope", () => Scope.make()),
      Effect.bind("exit", ({ innerScope }) =>
        pipe(this.lookup(key), Scope.provide(innerScope), Effect.exit),
      ),
      Effect.map(({ exit, innerScope }) => ({
        key,
        exit,
        finalizer: () => {
          console.log(`[ScopedCache #${this.cacheId}] Entry finalizer running for ${String(key)}`);
          return Scope.close(innerScope, exit);
        },
        ownerCount: MutableRef.make(0),
      })),
    );
  }
}

export type Lookup<Key, Value, Error, Environment> = (
  key: Key,
) => Effect.Effect<Value, Error, Environment | Scope.Scope>;

export const make = <Key, Value, Error, Environment>(options: {
  readonly lookup: Lookup<Key, Value, Error, Environment>;
}): Effect.Effect<ScopedCache<Key, Value, Error, Environment>, never, never> =>
  Effect.succeed(new ScopedCacheImpl(options.lookup));
