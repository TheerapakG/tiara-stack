import { Effect, Fiber, pipe, PubSub, Queue, Ref, Scope } from "effect";
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
 * - Continuously stores values from the queue in a Ref (regardless of start/stop state)
 * - Only emits values via the onEmit callback when started
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
      Ref.make(initial), // Last emitted value (to detect changes)
      Ref.make<Fiber.RuntimeFiber<never, never> | null>(null), // Store fiber
      Ref.make<Fiber.RuntimeFiber<never, never> | null>(null), // Emit fiber
      Ref.make(false), // started flag
    ]),
    Effect.flatMap(
      ([valueRef, lastEmittedRef, storeFiberRef, emitFiberRef, startedRef]) =>
        pipe(
          pubsub,
          PubSub.subscribe,
          Effect.flatMap((queue) => {
            // Spawn a fiber to continuously take from the queue and store values
            // This fiber runs regardless of start/stop state to keep values fresh
            // When the queue is closed/unsubscribed, Queue.take will fail and the loop will stop
            const storeFiber = pipe(
              Effect.forever(
                pipe(
                  Queue.take(queue),
                  Effect.flatMap((value) => Ref.set(valueRef, value)),
                  Effect.catchAllCause((cause) =>
                    // Handle interruption gracefully - if the queue is closed/unsubscribed,
                    // we stop the loop by not continuing forever
                    Effect.failCause(cause),
                  ),
                ),
              ),
              Effect.forkDaemon,
            );

            return pipe(
              storeFiber,
              Effect.flatMap((fiber) =>
                pipe(
                  Ref.set(storeFiberRef, fiber),
                  Effect.map(() => ({
                    poll: Ref.get(valueRef),
                    emit: (
                      onEmit: (value: T) => Effect.Effect<void, never, never>,
                    ) => {
                      // Spawn a fiber that watches for value changes and emits when started
                      const emitFiber = pipe(
                        Effect.forever(
                          pipe(
                            Ref.get(startedRef),
                            Effect.flatMap((started) => {
                              if (!started) {
                                // Not started yet, wait and check again
                                return pipe(
                                  Effect.sleep("10 millis"),
                                  Effect.flatMap(() => Effect.void),
                                );
                              }
                              // Started - check if value changed and emit
                              return pipe(
                                Ref.get(valueRef),
                                Effect.flatMap((currentValue) =>
                                  pipe(
                                    Ref.get(lastEmittedRef),
                                    Effect.flatMap((lastEmitted) => {
                                      if (currentValue !== lastEmitted) {
                                        return pipe(
                                          onEmit(currentValue),
                                          Effect.flatMap(() =>
                                            Ref.set(
                                              lastEmittedRef,
                                              currentValue,
                                            ),
                                          ),
                                        );
                                      }
                                      return pipe(
                                        Effect.sleep("10 millis"),
                                        Effect.flatMap(() => Effect.void),
                                      );
                                    }),
                                  ),
                                ),
                              );
                            }),
                          ),
                        ),
                        Effect.forkDaemon,
                      );

                      return pipe(
                        emitFiber,
                        Effect.flatMap((fiber) =>
                          pipe(Ref.set(emitFiberRef, fiber), Effect.asVoid),
                        ),
                      );
                    },
                    start: pipe(Ref.set(startedRef, true), Effect.asVoid),
                    stop: pipe(Ref.set(startedRef, false), Effect.asVoid),
                  })),
                ),
              ),
            );
          }),
        ),
    ),
  );
