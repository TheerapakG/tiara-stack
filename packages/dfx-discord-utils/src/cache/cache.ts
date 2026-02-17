import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import type { ReverseLookupCacheDriver } from "./driver";
import type { ReverseLookupCacheOp } from "./prelude";

const retryPolicy = Schedule.exponential("500 millis").pipe(
  Schedule.union(Schedule.spaced("10 seconds")),
);

export interface ReverseLookupCache<EDriver, EMiss, EPMiss, ERMiss, A> {
  readonly get: (parentId: string, resourceId: string) => Effect.Effect<A, EMiss | EDriver>;
  readonly put: (_: A) => Effect.Effect<void, EDriver | EMiss>;
  readonly update: <R, E>(
    parentId: string,
    resourceId: string,
    f: (_: A) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, EDriver | EMiss | E, R>;
  readonly getForParent: (
    parentId: string,
  ) => Effect.Effect<ReadonlyMap<string, A>, EDriver | EPMiss>;
  readonly getForResource: (
    resourceId: string,
  ) => Effect.Effect<ReadonlyMap<string, A>, EMiss | EDriver | ERMiss>;
  readonly size: Effect.Effect<number, EDriver>;
  readonly sizeForParent: (parentId: string) => Effect.Effect<number, EDriver>;
  readonly sizeForResource: (resourceId: string) => Effect.Effect<number, EDriver>;
  readonly set: (parentId: string, resourceId: string, resource: A) => Effect.Effect<void, EDriver>;
  readonly delete: (parentId: string, resourceId: string) => Effect.Effect<void, EDriver>;
  readonly parentDelete: (parentId: string) => Effect.Effect<void, EDriver>;
  readonly resourceDelete: (resourceId: string) => Effect.Effect<void, EDriver>;
  readonly refreshTTL: (parentId: string, resourceId: string) => Effect.Effect<void, EDriver>;
}

export const makeWithReverseLookup = <EOps, EDriver, EMiss, EPMiss, ERMiss, A>({
  driver,
  id,
  onMiss,
  onParentMiss,
  onResourceMiss,
  ops = Stream.empty,
}: {
  driver: ReverseLookupCacheDriver<EDriver, A>;
  ops?: Stream.Stream<ReverseLookupCacheOp<A>, EOps>;
  id: (_: A) => Effect.Effect<readonly [parentId: string, resourceId: string], EMiss>;
  onMiss: (parentId: string, resourceId: string) => Effect.Effect<A, EMiss>;
  onParentMiss: (parentId: string) => Effect.Effect<readonly [string, A][], EPMiss>;
  onResourceMiss: (resourceId: string) => Effect.Effect<readonly [string, A][], ERMiss>;
}): Effect.Effect<ReverseLookupCache<EDriver, EMiss, EPMiss, ERMiss, A>, never, Scope.Scope> =>
  Effect.gen(function* () {
    yield* Stream.runDrain(
      Stream.tap(ops, (op): Effect.Effect<void, EDriver> => {
        switch (op.op) {
          case "create":
          case "update":
            return driver.set(op.parentId, op.resourceId, op.resource);

          case "delete":
            return driver.delete(op.parentId, op.resourceId);

          case "parentDelete":
            return driver.parentDelete(op.parentId);

          case "resourceDelete":
            return driver.resourceDelete(op.resourceId);
        }
      }),
    ).pipe(
      Effect.tapErrorCause((_) => Effect.logError("ops error, restarting", _)),
      Effect.retry(retryPolicy),
      Effect.forkScoped,
      Effect.interruptible,
    );

    yield* driver.run.pipe(
      Effect.tapErrorCause((_) => Effect.logError("cache driver error, restarting", _)),
      Effect.retry(retryPolicy),
      Effect.forkScoped,
      Effect.interruptible,
    );

    const get = (parentId: string, resourceId: string) =>
      Effect.flatMap(
        driver.get(parentId, resourceId),
        Option.match({
          onNone: () =>
            Effect.tap(onMiss(parentId, resourceId), (a) => driver.set(parentId, resourceId, a)),
          onSome: Effect.succeed,
        }),
      );

    const put = (_: A) =>
      Effect.flatMap(id(_), ([parentId, resourceId]) => driver.set(parentId, resourceId, _));

    const update = <R, E>(
      parentId: string,
      resourceId: string,
      f: (_: A) => Effect.Effect<A, E, R>,
    ) =>
      get(parentId, resourceId).pipe(
        Effect.flatMap(f),
        Effect.tap((a) => driver.set(parentId, resourceId, a)),
      );

    return {
      ...driver,

      get,
      put,
      update,

      getForParent: (parentId: string) =>
        Effect.flatMap(
          driver.getForParent(parentId),
          Option.match({
            onNone: () =>
              onParentMiss(parentId).pipe(
                Effect.tap((entries) =>
                  Effect.all(entries.map(([id, a]) => driver.set(parentId, id, a))),
                ),
                Effect.map((entries) => new Map(entries) as ReadonlyMap<string, A>),
              ),
            onSome: Effect.succeed,
          }),
        ),

      getForResource: (resourceId: string) =>
        Effect.flatMap(
          driver.getForResource(resourceId),
          Option.match({
            onNone: () =>
              onResourceMiss(resourceId).pipe(
                Effect.tap((entries) =>
                  Effect.all(entries.map(([parentId, a]) => driver.set(parentId, resourceId, a))),
                ),
                Effect.map((entries) => new Map(entries) as ReadonlyMap<string, A>),
              ),
            onSome: Effect.succeed,
          }),
        ),
    } as const;
  }).pipe(
    Effect.annotateLogs({
      package: "dfx-discord-utils",
      service: "ReverseLookupCache",
    }),
  );
