import {
  Effect,
  Option,
  pipe,
  TQueue,
  TPubSub,
  Scope,
  STM,
  TRef,
} from "effect";
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
 * @param pubsub - The TPubSub instance to subscribe to
 * @param initial - The initial value to use as the polling result
 * @returns An ExternalSource that requires Scope during creation
 */
export const make = <T>(
  pubsub: TPubSub.TPubSub<T>,
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
        TPubSub.subscribe(pubsub),
        Effect.tap((queue) =>
          pipe(
            TQueue.take(queue),
            STM.tap((value) => TRef.set(valueRef, value)),
            STM.commit,
            Effect.tap((value) =>
              pipe(
                TRef.get(onEmitRef),
                STM.commit,
                Effect.flatMap(
                  Effect.transposeMapOption((onEmit) => onEmit(value)),
                ),
                Effect.whenEffect(pipe(TRef.get(startedRef), STM.commit)),
              ),
            ),
            Effect.forever,
            Effect.forkScoped,
          ),
        ),
      ),
    ),
    Effect.map(({ valueRef, startedRef, onEmitRef }) => ({
      poll: () => pipe(TRef.get(valueRef), STM.commit),
      emit: (
        onEmit: (
          value: T,
        ) => Effect.Effect<void, never, SignalService.SignalService>,
      ) =>
        pipe(TRef.set(onEmitRef, Option.some(onEmit)), STM.asVoid, STM.commit),
      start: () => TRef.set(startedRef, true),
      stop: () => TRef.set(startedRef, false),
    })),
  );
