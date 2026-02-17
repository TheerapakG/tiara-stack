import { Effect, Option } from "effect";

export interface ReverseLookupCacheDriver<E, T> {
  readonly size: Effect.Effect<number, E>;
  sizeForParent: (parentId: string) => Effect.Effect<number, E>;
  sizeForResource: (resourceId: string) => Effect.Effect<number, E>;
  get: (parentId: string, resourceId: string) => Effect.Effect<Option.Option<T>, E>;
  getForParent: (parentId: string) => Effect.Effect<Option.Option<ReadonlyMap<string, T>>, E>;
  getForResource: (resourceId: string) => Effect.Effect<Option.Option<ReadonlyMap<string, T>>, E>;
  set: (parentId: string, resourceId: string, resource: T) => Effect.Effect<void, E>;
  delete: (parentId: string, resourceId: string) => Effect.Effect<void, E>;
  parentDelete: (parentId: string) => Effect.Effect<void, E>;
  resourceDelete: (resourceId: string) => Effect.Effect<void, E>;
  refreshTTL: (parentId: string, resourceId: string) => Effect.Effect<void, E>;
  readonly run: Effect.Effect<never, E>;
}

export const createReverseLookupDriver = <E, T>(
  driver: ReverseLookupCacheDriver<E, T>,
): ReverseLookupCacheDriver<E, T> => driver;
