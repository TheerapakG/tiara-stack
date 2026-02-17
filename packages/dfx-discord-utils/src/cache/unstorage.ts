import type { CacheDriver, ParentCacheDriver } from "dfx/Cache/driver";
import { createParentDriver } from "dfx/Cache/driver";
import { createReverseLookupDriver, type ReverseLookupCacheDriver } from "./driver";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { prefixStorage, type Storage } from "unstorage";

export interface UnstorageOpts {
  /** The unstorage storage instance */
  readonly storage: Storage;

  /**
   * The prefix for cache item keys in storage.
   * Defaults to no prefix.
   */
  readonly prefix?: string;
}

export interface UnstorageWithParentOpts extends UnstorageOpts {
  /**
   * The prefix for parent-to-child mapping keys in storage.
   * Defaults to "mapping:".
   */
  readonly mappingPrefix?: string;
}

export interface UnstorageWithReverseLookupOpts extends UnstorageOpts {
  /**
   * The prefix for parent-to-child mapping keys in storage.
   * Defaults to "mapping:".
   */
  readonly mappingPrefix?: string;

  /**
   * The prefix for reverse lookup (resource-to-parent) mapping keys.
   * Defaults to "reverse:".
   */
  readonly reversePrefix?: string;
}

const makeStorage = (storage: Storage, prefix?: string) =>
  prefix ? prefixStorage(storage, prefix) : storage;

// Simple cache driver (no parent)
const make = <T>(opts: UnstorageOpts): CacheDriver<never, T> => {
  const { prefix = "", storage } = opts;
  const prefixedStorage = makeStorage(storage, prefix);

  const driver: CacheDriver<never, T> = {
    size: Effect.promise(() => prefixedStorage.getKeys("").then((keys) => keys.length)),

    get: (resourceId) =>
      Effect.promise(async () => {
        const value = (await prefixedStorage.getItem(resourceId)) as T | null;
        return Option.fromNullable(value);
      }),

    refreshTTL: () => Effect.void,

    set: (resourceId, resource) =>
      Effect.promise(() => prefixedStorage.setItem(resourceId, resource as never)),

    delete: (resourceId) => Effect.promise(() => prefixedStorage.removeItem(resourceId)),

    run: Effect.never,
  };

  return driver;
};

export const create = <T>(opts: UnstorageOpts): Effect.Effect<CacheDriver<never, T>> =>
  Effect.sync(() => make<T>(opts));

// Parent cache driver (without reverse lookup)
export const createWithParent = <T>({
  mappingPrefix = "mapping:",
  ...opts
}: UnstorageWithParentOpts): Effect.Effect<ParentCacheDriver<never, T>> =>
  Effect.sync(() => {
    const store = make<T>(opts);
    const { storage } = opts;

    const mappingStorage = makeStorage(storage, mappingPrefix);

    const getParentIds = (parentId: string): Effect.Effect<Set<string>, never> =>
      Effect.promise(async () => {
        const value = await mappingStorage.getItem<string[]>(parentId);
        return new Set(value ?? []);
      });

    const setParentIds = (parentId: string, ids: Set<string>): Effect.Effect<void, never> =>
      Effect.promise(async () => {
        if (ids.size === 0) {
          await mappingStorage.removeItem(parentId);
        } else {
          await mappingStorage.setItem(parentId, Array.from(ids));
        }
      });

    return createParentDriver({
      size: store.size,
      sizeForParent: (parentId) =>
        Effect.gen(function* () {
          const ids = yield* getParentIds(parentId);
          return ids.size;
        }),

      refreshTTL: () => Effect.void,

      get: (_, id) => store.get(id),

      getForParent: (parentId) =>
        Effect.gen(function* () {
          const ids = yield* getParentIds(parentId);
          if (ids.size === 0) return Option.none();

          const entries = yield* Effect.forEach(
            Array.from(ids),
            (id) => store.get(id).pipe(Effect.map((item) => [id, item] as const)),
            { concurrency: "unbounded" },
          );

          const result = new Map<string, T>();
          const validIds = new Set<string>();
          for (const [id, item] of entries) {
            if (Option.isSome(item)) {
              result.set(id, item.value);
              validIds.add(id);
            }
          }

          if (validIds.size !== ids.size) {
            yield* setParentIds(parentId, validIds);
          }

          return result.size > 0 ? Option.some(result) : Option.none();
        }),

      set: (parentId, resourceId, resource) =>
        Effect.gen(function* () {
          yield* store.set(resourceId, resource);

          const existingIds = yield* getParentIds(parentId);
          existingIds.add(resourceId);
          yield* setParentIds(parentId, existingIds);
        }).pipe(Effect.catchAllDefect((e) => Effect.logWarning("Cache set failed", e))),

      delete: (parentId, resourceId) =>
        Effect.gen(function* () {
          yield* store.delete(resourceId);

          const existingIds = yield* getParentIds(parentId);
          existingIds.delete(resourceId);
          yield* setParentIds(parentId, existingIds);
        }).pipe(Effect.catchAllDefect((e) => Effect.logWarning("Cache delete failed", e))),

      parentDelete: (parentId) =>
        Effect.gen(function* () {
          const ids = yield* getParentIds(parentId);
          yield* setParentIds(parentId, new Set());

          const effects: Effect.Effect<void, never>[] = [];
          for (const id of ids) {
            effects.push(store.delete(id));
          }
          yield* Effect.all(effects, { concurrency: "unbounded", discard: true });
        }).pipe(Effect.catchAllDefect((e) => Effect.logWarning("Cache parentDelete failed", e))),

      run: Effect.never,
    });
  });

// Parent cache driver with reverse lookup
export const createWithReverseLookup = <T>({
  mappingPrefix = "mapping:",
  reversePrefix = "reverse:",
  ...opts
}: UnstorageWithReverseLookupOpts): Effect.Effect<ReverseLookupCacheDriver<never, T>> =>
  Effect.sync(() => {
    const { storage } = opts;
    const { prefix = "" } = opts;
    const prefixedStorage = makeStorage(storage, prefix);
    const mappingStorage = makeStorage(storage, mappingPrefix);
    const reverseStorage = makeStorage(storage, reversePrefix);

    const getParentIds = (parentId: string): Effect.Effect<Set<string>, never> =>
      Effect.promise(async () => {
        const value = await mappingStorage.getItem<string[]>(parentId);
        return new Set(value ?? []);
      });

    const setParentIds = (parentId: string, ids: Set<string>): Effect.Effect<void, never> =>
      Effect.promise(async () => {
        if (ids.size === 0) {
          await mappingStorage.removeItem(parentId);
        } else {
          await mappingStorage.setItem(parentId, Array.from(ids));
        }
      });

    const getResourceParentIds = (resourceId: string): Effect.Effect<Set<string>, never> =>
      Effect.promise(async () => {
        const value = await reverseStorage.getItem<string[]>(resourceId);
        return new Set(value ?? []);
      });

    const setResourceParentIds = (
      resourceId: string,
      parentIds: Set<string>,
    ): Effect.Effect<void, never> =>
      Effect.promise(async () => {
        if (parentIds.size === 0) {
          await reverseStorage.removeItem(resourceId);
        } else {
          await reverseStorage.setItem(resourceId, Array.from(parentIds));
        }
      });

    const driver: ReverseLookupCacheDriver<never, T> = {
      size: Effect.promise(() => prefixedStorage.getKeys("").then((keys) => keys.length)),

      sizeForParent: (parentId) =>
        Effect.gen(function* () {
          const ids = yield* getParentIds(parentId);
          return ids.size;
        }),

      sizeForResource: (resourceId) =>
        Effect.gen(function* () {
          const parentIds = yield* getResourceParentIds(resourceId);
          return parentIds.size;
        }),

      get: (parentId, resourceId) =>
        Effect.promise(async () => {
          const value = (await prefixedStorage.getItem(`${parentId}:${resourceId}`)) as T | null;
          return Option.fromNullable(value);
        }),

      getForParent: (parentId) =>
        Effect.gen(function* () {
          const ids = yield* getParentIds(parentId);
          if (ids.size === 0) return Option.none();

          const entries = yield* Effect.forEach(
            Array.from(ids),
            (resourceId) =>
              Effect.promise(async () => {
                const value = (await prefixedStorage.getItem(
                  `${parentId}:${resourceId}`,
                )) as T | null;
                return [resourceId, value] as const;
              }),
            { concurrency: "unbounded" },
          );

          const result = new Map<string, T>();
          const validIds = new Set<string>();
          for (const [id, value] of entries) {
            if (value !== null) {
              result.set(id, value);
              validIds.add(id);
            }
          }

          if (validIds.size !== ids.size) {
            yield* setParentIds(parentId, validIds);
          }

          return result.size > 0 ? Option.some(result) : Option.none();
        }),

      getForResource: (resourceId) =>
        Effect.gen(function* () {
          const parentIds = yield* getResourceParentIds(resourceId);
          if (parentIds.size === 0) return Option.none();

          const entries = yield* Effect.forEach(
            Array.from(parentIds),
            (parentId) =>
              Effect.promise(async () => {
                const value = (await prefixedStorage.getItem(
                  `${parentId}:${resourceId}`,
                )) as T | null;
                return [parentId, value] as const;
              }),
            { concurrency: "unbounded" },
          );

          const result = new Map<string, T>();
          const validParentIds = new Set<string>();
          for (const [parentId, value] of entries) {
            if (value !== null) {
              result.set(parentId, value);
              validParentIds.add(parentId);
            }
          }

          if (validParentIds.size !== parentIds.size) {
            yield* setResourceParentIds(resourceId, validParentIds);
          }

          return result.size > 0 ? Option.some(result) : Option.none();
        }),

      set: (parentId, resourceId, resource) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            prefixedStorage.setItem(`${parentId}:${resourceId}`, resource as never),
          );

          const existingIds = yield* getParentIds(parentId);
          existingIds.add(resourceId);
          yield* setParentIds(parentId, existingIds);

          const existingParentIds = yield* getResourceParentIds(resourceId);
          existingParentIds.add(parentId);
          yield* setResourceParentIds(resourceId, existingParentIds);
        }).pipe(Effect.catchAllDefect((e) => Effect.logWarning("Cache set failed", e))),

      delete: (parentId, resourceId) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => prefixedStorage.removeItem(`${parentId}:${resourceId}`));

          const existingIds = yield* getParentIds(parentId);
          existingIds.delete(resourceId);
          yield* setParentIds(parentId, existingIds);

          const existingParentIds = yield* getResourceParentIds(resourceId);
          existingParentIds.delete(parentId);
          yield* setResourceParentIds(resourceId, existingParentIds);
        }).pipe(Effect.catchAllDefect((e) => Effect.logWarning("Cache delete failed", e))),

      parentDelete: (parentId) =>
        Effect.gen(function* () {
          const ids = yield* getParentIds(parentId);
          yield* setParentIds(parentId, new Set());

          for (const resourceId of ids) {
            const existingParentIds = yield* getResourceParentIds(resourceId);
            existingParentIds.delete(parentId);
            yield* setResourceParentIds(resourceId, existingParentIds);
          }

          const effects: Effect.Effect<void, never>[] = [];
          for (const resourceId of ids) {
            effects.push(
              Effect.promise(() => prefixedStorage.removeItem(`${parentId}:${resourceId}`)),
            );
          }
          yield* Effect.all(effects, { concurrency: "unbounded", discard: true });
        }).pipe(Effect.catchAllDefect((e) => Effect.logWarning("Cache parentDelete failed", e))),

      resourceDelete: (resourceId) =>
        Effect.gen(function* () {
          const parentIds = yield* getResourceParentIds(resourceId);
          yield* setResourceParentIds(resourceId, new Set());

          for (const parentId of parentIds) {
            const existingIds = yield* getParentIds(parentId);
            existingIds.delete(resourceId);
            yield* setParentIds(parentId, existingIds);
          }

          const effects: Effect.Effect<void, never>[] = [];
          for (const parentId of parentIds) {
            effects.push(
              Effect.promise(() => prefixedStorage.removeItem(`${parentId}:${resourceId}`)),
            );
          }
          yield* Effect.all(effects, { concurrency: "unbounded", discard: true });
        }).pipe(Effect.catchAllDefect((e) => Effect.logWarning("Cache resourceDelete failed", e))),

      refreshTTL: () => Effect.void,

      run: Effect.never,
    };

    return createReverseLookupDriver(driver);
  });
