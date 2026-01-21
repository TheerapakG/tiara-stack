import { Effect, Effectable, Equal, pipe, STM, TRef, TSet } from "effect";
import { Observable } from "../observability";
import { DependencySignal, DependencySymbol } from "./dependencySignal";
import { DependentSignal } from "./dependentSignal";
import * as SignalService from "./signalService";

export class Signal<T = unknown>
  extends Effectable.Class<T, never, SignalService.SignalService>
  implements DependencySignal<T, never, never>
{
  readonly _tag = "Signal" as const;
  readonly [DependencySymbol]: DependencySignal<T, never, never> = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _valueRef: TRef.TRef<T>;
  private _lastValueRef: TRef.TRef<T>;
  private _dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>;

  constructor(
    value: TRef.TRef<T>,
    lastValue: TRef.TRef<T>,
    dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._valueRef = value;
    this._lastValueRef = lastValue;
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

  getDependents(): STM.STM<TSet.TSet<WeakRef<DependentSignal> | DependentSignal>, never, never> {
    return STM.succeed(this._dependents);
  }

  value(): Effect.Effect<T, never, SignalService.SignalService> {
    return pipe(
      SignalService.bindDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "Signal.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<T, never, SignalService.SignalService> {
    return this.value();
  }

  peek(): Effect.Effect<T, never, SignalService.SignalService> {
    return pipe(
      STM.Do,
      STM.bind("value", () => TRef.get(this._valueRef)),
      STM.bind("last", ({ value }) => TRef.getAndSet(this._lastValueRef, value)),
      STM.commit,
      Effect.tap(({ value, last }) =>
        Effect.when(() => Equal.equals(last, value))(SignalService.markUnchanged(this)),
      ),
      Effect.map(({ value }) => value),
      Observable.withSpan(this, "Signal.peek", {
        captureStackTrace: true,
      }),
    );
  }

  setValue(value: T): Effect.Effect<void, never, SignalService.SignalService> {
    return SignalService.enqueueNotify(
      new SignalService.NotifyRequest({
        signal: this,
        beforeNotify: () => pipe(TRef.set(this._valueRef, value), STM.commit),
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
          pipe(
            TRef.get(this._valueRef),
            STM.commit,
            Effect.flatMap((value) => updater(value)),
            Effect.tap((value) => pipe(TRef.set(this._valueRef, value), STM.commit)),
          ),
      }),
    );
  }

  reconcile(): STM.STM<void, never, never> {
    return STM.void;
  }
}

export type Value<S extends Signal<unknown>> = Effect.Effect.Success<ReturnType<S["peek"]>>;

export const makeSTM = <T>(value: T, options?: Observable.ObservableOptions) =>
  pipe(
    STM.all({
      valueRef: TRef.make(value),
      lastValueRef: TRef.make(value),
      dependents: TSet.empty<WeakRef<DependentSignal> | DependentSignal>(),
    }),
    STM.map(
      ({ valueRef, lastValueRef, dependents }) =>
        new Signal(valueRef, lastValueRef, dependents, options ?? {}),
    ),
  );

export const make = <T>(value: T, options?: Observable.ObservableOptions) =>
  pipe(
    makeSTM(value, options),
    STM.commit,
    Observable.withSpan(
      {
        _tag: "Signal" as const,
        [Observable.ObservableSymbol]: options ?? {},
      },
      "Signal.make",
      {
        captureStackTrace: true,
      },
    ),
  );
