import { Data, Effect, Option, pipe, STM, TRef } from "effect";
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

type ManualEmitExternalSourceState<T> = {
  valueRef: TRef.TRef<T>;
  onEmitRef: TRef.TRef<
    Option.Option<(value: T) => Effect.Effect<void, never, SignalService.SignalService>>
  >;
};

const ManualEmitExternalSourceTaggedClass: new <T>(
  args: Readonly<ManualEmitExternalSourceState<T>>,
) => Readonly<ManualEmitExternalSourceState<T>> & {
  readonly _tag: "ManualEmitExternalSource";
} = Data.TaggedClass("ManualEmitExternalSource");

export class ManualEmitExternalSource<T>
  extends ManualEmitExternalSourceTaggedClass<T>
  implements ExternalSource<T>
{
  readonly poll = () => TRef.get(this.valueRef);

  readonly emit = (onEmit: (value: T) => Effect.Effect<void, never, SignalService.SignalService>) =>
    TRef.set(this.onEmitRef, Option.some(onEmit));
}

type ManualEmitterState<T> = { source: ManualEmitExternalSource<T> };

const ManualEmitterTaggedClass: new <T>(
  args: Readonly<ManualEmitterState<T>>,
) => Readonly<ManualEmitterState<T>> & { readonly _tag: "ManualEmitter" } =
  Data.TaggedClass("ManualEmitter");

export class ManualEmitExternalSourceEmitter<T>
  extends ManualEmitterTaggedClass<T>
  implements ManualEmitter<T>
{
  readonly emit = (value: T) =>
    pipe(
      TRef.set(this.source.valueRef, value),
      STM.commit,
      Effect.tap(() =>
        pipe(
          TRef.get(this.source.onEmitRef),
          STM.commit,
          Effect.flatMap(Effect.transposeMapOption((onEmit) => onEmit(value))),
        ),
      ),
    );
}

/**
 * Creates an ExternalSource adapter for manual emitting.
 *
 * The adapter stores every emitted value immediately for polling, and the returned tagged
 * emitter forwards each value to any registered onEmit callback after storing it. No Scope
 * is required because there is no background subscription.
 *
 * @param initial - The initial value to use as the polling result
 * @returns An object containing the ExternalSource and tagged ManualEmitter
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
        Option.Option<(value: T) => Effect.Effect<void, never, SignalService.SignalService>>
      >(Option.none()),
    }),
    Effect.map(
      ({ valueRef, onEmitRef }) => new ManualEmitExternalSource<T>({ valueRef, onEmitRef }),
    ),
    Effect.map((source) => ({ source, emitter: new ManualEmitExternalSourceEmitter({ source }) })),
  );
