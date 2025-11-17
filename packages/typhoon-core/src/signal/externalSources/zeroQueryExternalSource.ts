import type {
  QueryRowType,
  Output,
  Change,
  Input,
  Format,
  ReadonlyJSONValue,
  View,
  HumanReadable,
} from "@rocicorp/zero";
import { applyChange } from "@rocicorp/zero";
import {
  Effect,
  Either,
  Option,
  pipe,
  Scope,
  SynchronizedRef,
  Match,
  flow,
  Array,
  Predicate,
} from "effect";
import {
  Complete,
  Optimistic,
  type Result,
} from "../../schema/zeroQueryResult";
import type { ExternalSource } from "../externalComputed";
import { ZeroService } from "../../services/zeroService";

/**
 * Creates an ExternalSource adapter for Zero queries.
 *
 * This adapter uses Zero.materialize to subscribe to query changes.
 * Values are optimistically resolved from local cache, so no initial value is needed.
 * The adapter stores values immediately upon emission (before start/after stop)
 * to capture values, but only emits them when started.
 *
 * The implementation:
 * - Uses Zero.materialize to create a TypedView
 * - Subscribes to view changes via addListener
 * - Stores every value in a Ref for polling (regardless of start/stop state)
 * - Emits every value via the onEmit callback when started
 * - Wraps values in Optimistic or Complete result types based on resultType
 *   ('unknown' → Optimistic, 'complete' → Complete)
 *
 * @param query - The Zero query to materialize
 * @param options - Optional options for materialize
 * @returns An ExternalSource that requires ZeroService and Scope during creation
 */
type TimeUnit = "s" | "m" | "h" | "d" | "y";

/**
 * Time To Live. This is used for query expiration.
 * - `forever` means the query will never expire.
 * - `none` means the query will expire immediately.
 * - A number means the query will expire after that many milliseconds.
 * - A negative number means the query will never expire, this is same as 'forever'.
 * - A string like `1s` means the query will expire after that many seconds.
 * - A string like `1m` means the query will expire after that many minutes.
 * - A string like `1h` means the query will expire after that many hours.
 * - A string like `1d` means the query will expire after that many days.
 * - A string like `1y` means the query will expire after that many years.
 */
type TTL = `${number}${TimeUnit}` | "forever" | "none" | number;

/**
 * Options for materializing a Zero query.
 */
export type ZeroMaterializeOptions = {
  /**
   * Time To Live. This is the amount of time to keep the rows associated with
   * this query after cleanup has been called.
   */
  ttl?: TTL | undefined;
};

export type ErroredQuery =
  | {
      error: "app";
      id: string;
      name: string;
      details: ReadonlyJSONValue;
    }
  | {
      error: "http";
      id: string;
      name: string;
      status: number;
      details: ReadonlyJSONValue;
    }
  | {
      error: "zero";
      id: string;
      name: string;
      details: ReadonlyJSONValue;
    };

class ZeroQueryExternalSource<T extends ReadonlyJSONValue | View>
  implements ExternalSource<Either.Either<Result<T>, ErroredQuery>>, Output
{
  constructor(
    private readonly input: Input,
    private readonly format: Format,
    private readonly resultTypeRef: SynchronizedRef.SynchronizedRef<
      Either.Either<"unknown" | "complete", ErroredQuery>
    >,
    private readonly dirtyRef: SynchronizedRef.SynchronizedRef<boolean>,
    private readonly valueRef: SynchronizedRef.SynchronizedRef<{ "": T }>,
    private readonly startedRef: SynchronizedRef.SynchronizedRef<boolean>,
    private readonly onEmitRef: SynchronizedRef.SynchronizedRef<
      Option.Option<
        (
          value: Either.Either<Result<T>, ErroredQuery>,
        ) => Effect.Effect<void, never, never>
      >
    >,
  ) {
    this.input.setOutput(this);
  }

  hydrate() {
    return SynchronizedRef.updateEffect(this.dirtyRef, () =>
      pipe(
        SynchronizedRef.get(this.valueRef),
        Effect.tap((value) =>
          pipe(
            this.input.fetch({}),
            Array.forEach((node) =>
              applyChange(
                value,
                { type: "add", node },
                this.input.getSchema(),
                "",
                this.format,
              ),
            ),
          ),
        ),
        Effect.as(true),
      ),
    );
  }

  flush() {
    return SynchronizedRef.updateEffect(this.dirtyRef, (dirty) =>
      pipe(dirty ? this.doEmit() : Effect.void, Effect.as(false)),
    );
  }

  push(change: Change) {
    Effect.runFork(
      SynchronizedRef.updateEffect(this.dirtyRef, () =>
        pipe(
          SynchronizedRef.get(this.valueRef),
          Effect.tap((value) =>
            applyChange(value, change, this.input.getSchema(), "", this.format),
          ),
          Effect.as(true),
        ),
      ),
    );
  }

  get poll() {
    return pipe(
      Effect.all({
        value: SynchronizedRef.get(this.valueRef),
        resultType: SynchronizedRef.get(this.resultTypeRef),
      }),
      Effect.map(({ value, resultType }) =>
        pipe(
          resultType,
          Either.map(
            flow(
              Match.value,
              Match.when("complete", () => new Complete({ value: value[""] })),
              Match.when("unknown", () => new Optimistic({ value: value[""] })),
              Match.exhaustive,
            ),
          ),
        ),
      ),
    );
  }

  emit(
    onEmit: (
      value: Either.Either<Result<T>, ErroredQuery>,
    ) => Effect.Effect<void, never, never>,
  ) {
    return SynchronizedRef.set(this.onEmitRef, Option.some(onEmit));
  }

  doEmit() {
    return pipe(
      this.poll,
      Effect.tap((result) =>
        pipe(
          SynchronizedRef.get(this.onEmitRef),
          Effect.flatMap(Effect.transposeMapOption((onEmit) => onEmit(result))),
        ),
      ),
      Effect.whenEffect(SynchronizedRef.get(this.startedRef)),
    );
  }

  get start() {
    return SynchronizedRef.set(this.startedRef, true);
  }

  get stop() {
    return SynchronizedRef.set(this.startedRef, false);
  }
}

export const make = <
  Q,
  T extends ReadonlyJSONValue | View = HumanReadable<
    QueryRowType<Q>
  > extends infer T extends ReadonlyJSONValue | View
    ? T
    : never,
>(
  query: Q,
  options?: ZeroMaterializeOptions,
): Effect.Effect<
  ZeroQueryExternalSource<T>,
  never,
  ZeroService<any, any> | Scope.Scope
> =>
  pipe(
    ZeroService<any, any>(),
    Effect.flatMap((zero) =>
      zero.materialize(
        query,
        (
          _query,
          input,
          format,
          onDestroy,
          onTransactionCommit,
          queryComplete,
          _updateTTL,
        ) =>
          pipe(
            Effect.all({
              resultTypeRef: SynchronizedRef.make<
                Either.Either<"unknown" | "complete", ErroredQuery>
              >(Either.right("unknown")),
              dirtyRef: SynchronizedRef.make(false),
              valueRef: SynchronizedRef.make<{ "": T }>({
                "": (format.singular ? undefined : []) as T,
              }),
              startedRef: SynchronizedRef.make(false),
              onEmitRef: SynchronizedRef.make<
                Option.Option<
                  (
                    value: Either.Either<Result<T>, ErroredQuery>,
                  ) => Effect.Effect<void, never, never>
                >
              >(Option.none()),
            }),
            Effect.tap(({ resultTypeRef }) =>
              pipe(
                Match.value(queryComplete),
                Match.when(true, () =>
                  SynchronizedRef.set(resultTypeRef, Either.right("complete")),
                ),
                Match.when(Predicate.hasProperty("error"), (error) =>
                  SynchronizedRef.set(resultTypeRef, Either.left(error)),
                ),
                Match.orElse((queryComplete) =>
                  Effect.forkDaemon(
                    pipe(
                      Effect.tryPromise({
                        try: () => queryComplete,
                        catch: (error) => error as ErroredQuery,
                      }),
                      Effect.map(() => "complete" as const),
                      Effect.either,
                      Effect.tap((result) =>
                        SynchronizedRef.set(resultTypeRef, result),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Effect.map(
              (refs) =>
                new ZeroQueryExternalSource<T>(
                  input,
                  format,
                  refs.resultTypeRef,
                  refs.dirtyRef,
                  refs.valueRef,
                  refs.startedRef,
                  refs.onEmitRef,
                ),
            ),
            Effect.tap((source) =>
              onTransactionCommit(() => Effect.runFork(source.flush())),
            ),
            Effect.tap(() =>
              Effect.addFinalizer(() => Effect.sync(() => onDestroy())),
            ),
          ),
        options,
      ),
    ),
  );
