import { Effect, Effectable, pipe, STM, TSet } from "effect";
import { Observable } from "../observability";
import { DependencySignal, DependencySymbol } from "./dependencySignal";
import { DependentSignal } from "./dependentSignal";
import * as SignalService from "./signalService";
import { bindDependency, SignalContext } from "./signalContext";

export class Signal<T = unknown>
  extends Effectable.Class<
    T,
    never,
    SignalContext | SignalService.SignalService
  >
  implements DependencySignal<T, never, never>
{
  readonly [DependencySymbol]: DependencySignal<T, never, never> = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _value: T;
  private _dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>;

  constructor(
    value: T,
    dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._value = value;
    this._dependents = dependents;
    this[Observable.ObservableSymbol] = options;
  }

  addDependent(dependent: WeakRef<DependentSignal> | DependentSignal) {
    return TSet.add(this._dependents, dependent);
  }

  removeDependent(dependent: WeakRef<DependentSignal> | DependentSignal) {
    return TSet.remove(this._dependents, dependent);
  }

  clearDependents() {
    return pipe(
      TSet.forEach(this._dependents, (dependent) =>
        dependent instanceof WeakRef
          ? (dependent.deref()?.removeDependency(this) ?? STM.void)
          : dependent.removeDependency(this),
      ),
      STM.zipRight(TSet.removeIf(this._dependents, () => true)),
    );
  }

  getDependents(): STM.STM<
    (WeakRef<DependentSignal> | DependentSignal)[],
    never,
    never
  > {
    return TSet.toArray(this._dependents);
  }

  value(): Effect.Effect<
    T,
    never,
    SignalContext | SignalService.SignalService
  > {
    return pipe(
      bindDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "Signal.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<
    T,
    never,
    SignalContext | SignalService.SignalService
  > {
    return this.value();
  }

  peek(): Effect.Effect<T, never, never> {
    return pipe(
      Effect.suspend(() => Effect.succeed(this._value)),
      Observable.withSpan(this, "Signal.peek", {
        captureStackTrace: true,
      }),
    );
  }

  setValue(value: T): Effect.Effect<void, never, SignalService.SignalService> {
    return SignalService.enqueueNotify(
      new SignalService.NotifyRequest({
        signal: this,
        beforeNotify: () =>
          Effect.suspend(() =>
            Effect.sync(() => {
              this._value = value;
            }),
          ),
      }),
    );
  }

  updateValue(
    updater: (value: T) => Effect.Effect<T>,
  ): Effect.Effect<void, never, SignalService.SignalService> {
    return SignalService.enqueueNotify(
      new SignalService.NotifyRequest({
        signal: this,
        beforeNotify: () =>
          Effect.suspend(() =>
            pipe(
              updater(this._value),
              Effect.tap((value) =>
                Effect.sync(() => {
                  this._value = value;
                }),
              ),
            ),
          ),
      }),
    );
  }

  reconcile(): STM.STM<void, never, never> {
    return STM.void;
  }
}

export type Value<S extends Signal<unknown>> = Effect.Effect.Success<
  ReturnType<S["peek"]>
>;

export const makeSTM = <T>(value: T, options?: Observable.ObservableOptions) =>
  pipe(
    TSet.empty<WeakRef<DependentSignal> | DependentSignal>(),
    STM.map((dependents) => new Signal(value, dependents, options ?? {})),
  );

export const make = <T>(value: T, options?: Observable.ObservableOptions) =>
  pipe(
    makeSTM(value, options),
    STM.commit,
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "Signal.make",
      {
        captureStackTrace: true,
      },
    ),
  );
