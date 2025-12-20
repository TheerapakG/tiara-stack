import { Effect, Exit, Fiber, Option, Scope, STM, TRef, pipe } from "effect";
import type { ExternalSource } from "../externalComputed";
import * as SignalService from "../signalService";

/**
 * Creates an ExternalSource adapter for a forked Fiber.
 *
 * The adapter watches the fiber's completion immediately (before start/after stop)
 * to capture the result for polling, but only forwards onEmit when started.
 *
 * @param fiber - A forked fiber whose completion result should be observed
 * @param initial - The initial value to use as the polling result
 * @returns An ExternalSource that requires Scope during creation
 */
export const make = <T>(
  fiber: Fiber.Fiber<T, unknown>,
  initial: T,
): Effect.Effect<
  ExternalSource<T>,
  never,
  Scope.Scope | SignalService.SignalService
> =>
  pipe(
    STM.all({
      valueRef: TRef.make(initial),
      startedRef: TRef.make(false),
      onEmitRef: TRef.make<
        Option.Option<
          (value: T) => Effect.Effect<void, never, SignalService.SignalService>
        >
      >(Option.none()),
    }),
    Effect.tap(({ valueRef, startedRef, onEmitRef }) =>
      pipe(
        Fiber.await(fiber),
        Effect.flatMap(
          Exit.match({
            onFailure: () => Effect.void,
            onSuccess: (value) =>
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
                    Effect.whenEffect(pipe(TRef.get(startedRef), STM.commit)),
                  ),
                ),
              ),
          }),
        ),
        Effect.forkScoped,
      ),
    ),
    Effect.map(({ valueRef, startedRef, onEmitRef }) => ({
      poll: () => TRef.get(valueRef),
      emit: (
        onEmit: (
          value: T,
        ) => Effect.Effect<void, never, SignalService.SignalService>,
      ) => TRef.set(onEmitRef, Option.some(onEmit)),
      start: () => TRef.set(startedRef, true),
      stop: () => TRef.set(startedRef, false),
    })),
  );
