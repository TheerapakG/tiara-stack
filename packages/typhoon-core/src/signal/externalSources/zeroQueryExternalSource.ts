import type { Query, ViewFactory, Zero } from "@rocicorp/zero";
import { Effect, Option, pipe, Ref, Runtime, Scope } from "effect";
import type { ExternalSource } from "../externalComputed";
import { ZeroService } from "../../services/zeroService";

/**
 * Result type indicating the query value was optimistically resolved from local cache.
 */
export type Optimistic<T> = {
  readonly _tag: "Optimistic";
  readonly value: T;
};

/**
 * Result type indicating the query value was updated from the server.
 */
export type Complete<T> = {
  readonly _tag: "Complete";
  readonly value: T;
};

/**
 * Result type for Zero query values, either Optimistic or Complete.
 */
export type ZeroQueryResult<T> = Optimistic<T> | Complete<T>;

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
export const make = <T>(
  query: Query<any, any, any>,
  options?: unknown,
): Effect.Effect<
  ExternalSource<ZeroQueryResult<T>>,
  never,
  ZeroService | Scope.Scope
> =>
  pipe(
    ZeroService,
    Effect.flatMap((zero: Zero<any>) =>
      pipe(
        Effect.all({
          valueRef: Ref.make<Option.Option<ZeroQueryResult<T>>>(Option.none()),
          startedRef: Ref.make(false),
          onEmitRef: Ref.make<
            Option.Option<
              (value: ZeroQueryResult<T>) => Effect.Effect<void, never, never>
            >
          >(Option.none()),
        }),
        Effect.map((refs) => ({ zero, ...refs })),
      ),
    ),
    Effect.flatMap(({ zero, valueRef, startedRef, onEmitRef }) =>
      pipe(
        Effect.sync(() => {
          const runtime = Runtime.defaultRuntime;

          // Helper to emit a value (stores and conditionally emits)
          const emitValue = (result: ZeroQueryResult<T>) => {
            Runtime.runSync(runtime)(
              pipe(
                Ref.set(valueRef, Option.some(result)),
                Effect.tap(() =>
                  pipe(
                    Ref.get(onEmitRef),
                    Effect.flatMap(
                      Effect.transposeMapOption((onEmit) => onEmit(result)),
                    ),
                    Effect.whenEffect(Ref.get(startedRef)),
                  ),
                ),
              ),
            );
          };

          let destroyCallback: (() => void) | undefined;

          // Create a ViewFactory that directly pipes values into the valueRef
          const viewFactory: ViewFactory<any, any, any, T> = (
            query,
            input,
            format,
            onDestroy,
            onTransactionCommit,
            queryComplete,
            updateTTL,
          ) => {
            // Store the onDestroy callback to be called when scope closes
            destroyCallback = onDestroy;

            // Determine if this is optimistic or complete based on queryComplete
            const isComplete =
              queryComplete === true ||
              (typeof queryComplete === "object" &&
                queryComplete !== null &&
                "error" in queryComplete === false);

            // The input is the view data, use it directly
            const value = input as T;

            const result: ZeroQueryResult<T> = isComplete
              ? { _tag: "Complete", value }
              : { _tag: "Optimistic", value };

            // Store the value directly in the ref
            emitValue(result);

            return value;
          };

          // Materialize with the factory
          zero.materialize(query, viewFactory, options as any);

          // Return cleanup function that calls onDestroy when scope closes
          return () => {
            if (destroyCallback) {
              destroyCallback();
            }
          };
        }),
        Effect.flatMap((cleanup) =>
          Effect.addFinalizer(() => Effect.sync(() => cleanup())),
        ),
        Effect.as({ zero, valueRef, startedRef, onEmitRef }),
      ),
    ),
    Effect.map(({ valueRef, startedRef, onEmitRef }) => ({
      poll: pipe(
        Ref.get(valueRef),
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.succeed({
                _tag: "Optimistic" as const,
                value: undefined as unknown as T,
              }),
            onSome: Effect.succeed,
          }),
        ),
      ),
      emit: (
        onEmit: (
          value: ZeroQueryResult<T>,
        ) => Effect.Effect<void, never, never>,
      ) => pipe(Ref.set(onEmitRef, Option.some(onEmit)), Effect.asVoid),
      start: pipe(Ref.set(startedRef, true), Effect.asVoid),
      stop: pipe(Ref.set(startedRef, false), Effect.asVoid),
    })),
  );
