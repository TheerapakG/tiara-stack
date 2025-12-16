import { Effect, Option, pipe, Ref } from "effect";
import * as SignalService from "../signalService";
import type { ExternalSource } from "../externalComputed";

/**
 * A manual emitter that allows values to be manually emitted.
 */
export interface ManualEmitter<T> {
  /**
   * Manually emit a value.
   */
  emit: (value: T) => Effect.Effect<void, never, SignalService.SignalService>;
}

/**
 * Creates an ExternalSource adapter for manual emitting.
 *
 * This adapter stores values immediately upon emission (before start/after stop)
 * to capture values, but only emits them when started.
 *
 * The implementation:
 * - Stores every value in a Ref for polling (regardless of start/stop state)
 * - Emits every value via the onEmit callback when started (no change detection)
 * - The emit method handles both storing and forwarding
 *
 * @param initial - The initial value to use as the polling result
 * @returns An object containing the ExternalSource and ManualEmitter
 */
export const make = <T>(
  initial: T,
): Effect.Effect<
  { source: ExternalSource<T>; emitter: ManualEmitter<T> },
  never,
  SignalService.SignalService
> =>
  pipe(
    Effect.all({
      valueRef: Ref.make(initial),
      startedRef: Ref.make(false),
      onEmitRef: Ref.make<
        Option.Option<
          (value: T) => Effect.Effect<void, never, SignalService.SignalService>
        >
      >(Option.none()),
    }),
    Effect.map(({ valueRef, startedRef, onEmitRef }) => ({
      source: {
        poll: () => Ref.get(valueRef),
        emit: (
          onEmit: (
            value: T,
          ) => Effect.Effect<void, never, SignalService.SignalService>,
        ) => pipe(Ref.set(onEmitRef, Option.some(onEmit)), Effect.asVoid),
        start: () => pipe(Ref.set(startedRef, true), Effect.asVoid),
        stop: () => pipe(Ref.set(startedRef, false), Effect.asVoid),
      },
      emitter: {
        emit: (value: T) =>
          pipe(
            Ref.set(valueRef, value),
            Effect.tap(() =>
              pipe(
                Ref.get(onEmitRef),
                Effect.flatMap(
                  Effect.transposeMapOption((onEmit) => onEmit(value)),
                ),
                Effect.whenEffect(Ref.get(startedRef)),
              ),
            ),
          ),
      },
    })),
  );
