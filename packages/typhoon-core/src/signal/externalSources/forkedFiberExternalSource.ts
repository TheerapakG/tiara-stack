import { Data, Effect, Exit, Fiber, Option, Scope, STM, TRef, pipe } from "effect";
import type { ExternalSource } from "../externalComputed";
import * as SignalService from "../signalService";

type ForkedFiberExternalSourceState<T> = {
  fiber: Fiber.Fiber<T, never>;
  valueRef: TRef.TRef<T>;
  onEmitRef: TRef.TRef<
    Option.Option<(value: T) => Effect.Effect<void, never, SignalService.SignalService>>
  >;
};

const ForkedFiberExternalSourceTaggedClass: new <T>(
  args: Readonly<ForkedFiberExternalSourceState<T>>,
) => Readonly<ForkedFiberExternalSourceState<T>> & {
  readonly _tag: "ForkedFiberExternalSource";
} = Data.TaggedClass("ForkedFiberExternalSource");

export class ForkedFiberExternalSource<T>
  extends ForkedFiberExternalSourceTaggedClass<T>
  implements ExternalSource<T>
{
  readonly poll = () => TRef.get(this.valueRef);

  readonly emit = (onEmit: (value: T) => Effect.Effect<void, never, SignalService.SignalService>) =>
    TRef.set(this.onEmitRef, Option.some(onEmit));
}

export const initialize = <T>(source: ForkedFiberExternalSource<T>) =>
  pipe(
    Fiber.await(source.fiber),
    Effect.flatMap(
      Exit.match({
        onFailure: () => Effect.void,
        onSuccess: (value) =>
          pipe(
            TRef.set(source.valueRef, value),
            STM.commit,
            Effect.tap(() =>
              pipe(
                TRef.get(source.onEmitRef),
                STM.commit,
                Effect.flatMap(Effect.transposeMapOption((onEmit) => onEmit(value))),
              ),
            ),
          ),
      }),
    ),
    Effect.forkScoped,
  );

/**
 * Creates an ExternalSource adapter for a forked Fiber.
 *
 * The adapter uses an initial value until the fiber completes; on success it
 * stores the fiber result for polling and forwards it to any registered
 * onEmit callback. Failures are ignored. A Scope is required for the await
 * fiber that is forked.
 *
 * @param fiber - A forked fiber whose completion result should be observed
 * @param initial - The initial value to use as the polling result
 * @returns An ExternalSource that requires Scope during creation
 */
export const make = <T>(
  fiber: Fiber.Fiber<T, never>,
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
      ({ valueRef, onEmitRef }) => new ForkedFiberExternalSource<T>({ fiber, valueRef, onEmitRef }),
    ),
    Effect.tap(initialize),
  );
