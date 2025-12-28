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
 * This adapter subscribes to the PubSub immediately upon creation to capture
 * values. The subscription requires a Scope which is bubbled up to the
 * creation effect.
 *
 * The implementation:
 * - Subscribes to PubSub at creation time (requires Scope)
 * - A single fiber continuously takes values from the queue
 * - Stores every value in a Ref for polling
 * - Emits every value via the onEmit callback
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
      onEmitRef: TRef.make<
        Option.Option<
          (value: T) => Effect.Effect<void, never, SignalService.SignalService>
        >
      >(Option.none()),
    }),
    Effect.tap(({ valueRef, onEmitRef }) =>
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
              ),
            ),
            Effect.forever,
            Effect.forkScoped,
          ),
        ),
      ),
    ),
    Effect.map(({ valueRef, onEmitRef }) => ({
      poll: () => TRef.get(valueRef),
      emit: (
        onEmit: (
          value: T,
        ) => Effect.Effect<void, never, SignalService.SignalService>,
      ) => TRef.set(onEmitRef, Option.some(onEmit)),
    })),
  );
