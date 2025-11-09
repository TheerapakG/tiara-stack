import { Effect, Option, pipe, PubSub, Queue, Ref, Scope } from "effect";
import type { ExternalSource } from "./externalComputed";

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
): Effect.Effect<ExternalSource<T>, never, Scope.Scope> =>
  pipe(
    Effect.all([
      Ref.make(initial), // Current value from PubSub
      Ref.make(false), // started flag
      Ref.make<Option.Option<(value: T) => Effect.Effect<void, never, never>>>(
        Option.none(),
      ), // onEmit callback
    ]),
    Effect.flatMap(([valueRef, startedRef, onEmitRef]) =>
      pipe(
        pubsub,
        PubSub.subscribe,
        Effect.flatMap((queue) => {
          // Spawn a single fiber that both stores and emits values
          // This fiber runs regardless of start/stop state to keep values fresh
          // When the queue is closed/unsubscribed, Queue.take will fail and Effect.forever will stop
          pipe(
            Effect.forever(
              pipe(
                Queue.take(queue),
                Effect.flatMap((value) =>
                  pipe(
                    Ref.set(valueRef, value),
                    Effect.flatMap(() =>
                      pipe(
                        Ref.get(startedRef),
                        Effect.flatMap((started) => {
                          if (started) {
                            return pipe(
                              Ref.get(onEmitRef),
                              Effect.flatMap((onEmitOption) =>
                                Option.match(onEmitOption, {
                                  onNone: () => Effect.void,
                                  onSome: (onEmit) => onEmit(value),
                                }),
                              ),
                            );
                          }
                          return Effect.void;
                        }),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Effect.forkDaemon,
          );

          return Effect.succeed({
            poll: Ref.get(valueRef),
            emit: (onEmit: (value: T) => Effect.Effect<void, never, never>) =>
              pipe(Ref.set(onEmitRef, Option.some(onEmit)), Effect.asVoid),
            start: pipe(Ref.set(startedRef, true), Effect.asVoid),
            stop: pipe(Ref.set(startedRef, false), Effect.asVoid),
          });
        }),
      ),
    ),
  );
