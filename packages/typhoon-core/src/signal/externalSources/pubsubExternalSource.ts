import { Effect, Option, pipe, PubSub, Queue, Ref, Scope } from "effect";
import type { ExternalSource } from "../externalComputed";
import * as SignalService from "../signalService";

/**
 * Creates an ExternalSource adapter for Effect PubSub.
 *
 * This adapter subscribes to the PubSub immediately upon creation (before start/after stop)
 * to capture values, but only emits them when started. The subscription requires a Scope
 * which is bubbled up to the creation effect.
 *
 * The implementation:
 * - Subscribes to PubSub at creation time (requires Scope)
 * - A single fiber continuously takes values from the queue
 * - Stores every value in a Ref for polling (regardless of start/stop state)
 * - Emits every value via the onEmit callback when started (no change detection)
 * - Handles interruption gracefully when the queue unsubscribes
 *
 * @param pubsub - The PubSub instance to subscribe to
 * @param initial - The initial value to use as the polling result
 * @returns An ExternalSource that requires Scope during creation
 */
export const make = <T>(
  pubsub: PubSub.PubSub<T>,
  initial: T,
): Effect.Effect<
  ExternalSource<T>,
  never,
  Scope.Scope | SignalService.Service
> =>
  pipe(
    Effect.all({
      valueRef: Ref.make(initial),
      startedRef: Ref.make(false),
      onEmitRef: Ref.make<
        Option.Option<
          (value: T) => Effect.Effect<void, never, SignalService.Service>
        >
      >(Option.none()),
    }),
    Effect.tap(({ valueRef, startedRef, onEmitRef }) =>
      pipe(
        PubSub.subscribe(pubsub),
        Effect.tap((queue) =>
          // Spawn a single fiber that both stores and emits values
          // This fiber runs regardless of start/stop state to keep values fresh
          pipe(
            Queue.take(queue),
            Effect.tap((value) => Ref.set(valueRef, value)),
            Effect.tap((value) =>
              pipe(
                Ref.get(onEmitRef),
                Effect.flatMap(
                  Effect.transposeMapOption((onEmit) => onEmit(value)),
                ),
                Effect.whenEffect(Ref.get(startedRef)),
              ),
            ),
            Effect.forever,
            Effect.forkScoped,
          ),
        ),
      ),
    ),
    Effect.map(({ valueRef, startedRef, onEmitRef }) => ({
      poll: Ref.get(valueRef),
      emit: (
        onEmit: (value: T) => Effect.Effect<void, never, SignalService.Service>,
      ) => pipe(Ref.set(onEmitRef, Option.some(onEmit)), Effect.asVoid),
      start: pipe(Ref.set(startedRef, true), Effect.asVoid),
      stop: pipe(Ref.set(startedRef, false), Effect.asVoid),
    })),
  );
