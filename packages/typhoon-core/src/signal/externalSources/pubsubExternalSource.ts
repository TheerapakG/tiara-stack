import { Data, Effect, Option, pipe, Scope, STM, TPubSub, TQueue, TRef } from "effect";
import type { ExternalSource } from "../externalComputed";
import * as SignalService from "../signalService";

type PubSubExternalSourceState<T> = {
  pubsub: TPubSub.TPubSub<T>;
  valueRef: TRef.TRef<T>;
  onEmitRef: TRef.TRef<
    Option.Option<(value: T) => Effect.Effect<void, never, SignalService.SignalService>>
  >;
};

const PubSubExternalSourceTaggedClass: new <T>(
  args: Readonly<PubSubExternalSourceState<T>>,
) => Readonly<PubSubExternalSourceState<T>> & { readonly _tag: "PubSubExternalSource" } =
  Data.TaggedClass("PubSubExternalSource");

export class PubSubExternalSource<T>
  extends PubSubExternalSourceTaggedClass<T>
  implements ExternalSource<T>
{
  readonly poll = () => TRef.get(this.valueRef);

  readonly emit = (onEmit: (value: T) => Effect.Effect<void, never, SignalService.SignalService>) =>
    TRef.set(this.onEmitRef, Option.some(onEmit));
}

export const initialize = <T>(source: PubSubExternalSource<T>) =>
  pipe(
    TPubSub.subscribe(source.pubsub),
    Effect.tap((queue) =>
      pipe(
        TQueue.take(queue),
        STM.tap((value) => TRef.set(source.valueRef, value)),
        STM.commit,
        Effect.tap((value) =>
          pipe(
            TRef.get(source.onEmitRef),
            STM.commit,
            Effect.flatMap(Effect.transposeMapOption((onEmit) => onEmit(value))),
          ),
        ),
        Effect.forever,
        Effect.forkScoped,
      ),
    ),
  );

/**
 * Creates an ExternalSource adapter for Effect PubSub.
 *
 * The adapter subscribes to the PubSub immediately (requires Scope) and
 * spins a background fiber that takes values, stores the latest for polling,
 * and forwards each one to any registered onEmit callback. Unsubscription
 * interrupts the background fiber cleanly.
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
): Effect.Effect<ExternalSource<T>, never, Scope.Scope | SignalService.SignalService> =>
  pipe(
    STM.all({
      valueRef: TRef.make(initial),
      onEmitRef: TRef.make<
        Option.Option<(value: T) => Effect.Effect<void, never, SignalService.SignalService>>
      >(Option.none()),
    }),
    Effect.map(
      ({ valueRef, onEmitRef }) => new PubSubExternalSource<T>({ pubsub, valueRef, onEmitRef }),
    ),
    Effect.tap(initialize),
  );
