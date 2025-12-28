import { Effect, Option, pipe, STM, TRef } from "effect";
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
 * This adapter stores values immediately upon emission to capture values.
 *
 * The implementation:
 * - Stores every value in a Ref for polling
 * - Emits every value via the onEmit callback
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
      valueRef: TRef.make(initial),
      onEmitRef: TRef.make<
        Option.Option<
          (value: T) => Effect.Effect<void, never, SignalService.SignalService>
        >
      >(Option.none()),
    }),
    Effect.map(({ valueRef, onEmitRef }) => ({
      source: {
        poll: () => TRef.get(valueRef),
        emit: (
          onEmit: (
            value: T,
          ) => Effect.Effect<void, never, SignalService.SignalService>,
        ) => TRef.set(onEmitRef, Option.some(onEmit)),
      },
      emitter: {
        emit: (value: T) =>
          pipe(
            TRef.set(valueRef, value),
            STM.commit,
            Effect.tap(() =>
              pipe(
                TRef.get(onEmitRef),
                STM.commit,
                Effect.flatMap(
                  Effect.transposeMapOption((onEmit) => onEmit(value)),
                ),
              ),
            ),
          ),
      },
    })),
  );
