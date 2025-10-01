import { Effect, Effectable, HashSet, pipe } from "effect";
import { Observable } from "../observability";
import {
  DependencySignal,
  DependencySymbol,
  notifyAllDependents,
} from "./dependencySignal";
import { DependentSignal } from "./dependentSignal";
import { bindScopeDependency, SignalContext } from "./signalContext";

export class Signal<T = unknown>
  extends Effectable.Class<T, never, SignalContext>
  implements DependencySignal<T, never, never>
{
  readonly [DependencySymbol]: DependencySignal<T, never, never> = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _value: T;
  private _dependents: HashSet.HashSet<DependentSignal>;

  constructor(value: T, options: Observable.ObservableOptions) {
    super();
    this._value = value;
    this._dependents = HashSet.empty();
    this[Observable.ObservableSymbol] = options;
  }

  addDependent(dependent: DependentSignal) {
    return Effect.sync(() => {
      this._dependents = HashSet.add(this._dependents, dependent);
    });
  }

  removeDependent(dependent: DependentSignal) {
    return Effect.sync(() => {
      this._dependents = HashSet.remove(this._dependents, dependent);
    });
  }

  clearDependents() {
    return Effect.sync(() => {
      HashSet.forEach(this._dependents, (dependent) =>
        dependent.removeDependency(this),
      );
      this._dependents = HashSet.empty();
    });
  }

  getDependents(): Effect.Effect<DependentSignal[], never, never> {
    return Effect.sync(() => HashSet.toValues(this._dependents));
  }

  get value(): Effect.Effect<T, never, SignalContext> {
    return pipe(
      bindScopeDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "Signal.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<T, never, SignalContext> {
    return this.value;
  }

  peek(): Effect.Effect<T, never, never> {
    return pipe(
      Effect.suspend(() => Effect.succeed(this._value)),
      Observable.withSpan(this, "Signal.peek", {
        captureStackTrace: true,
      }),
    );
  }

  setValue(value: T): Effect.Effect<void, never, never> {
    return pipe(
      this,
      notifyAllDependents(
        Effect.suspend(() =>
          Effect.sync(() => {
            this._value = value;
          }),
        ),
      ),
      Observable.withSpan(this, "Signal.setValue", {
        captureStackTrace: true,
      }),
    );
  }

  updateValue(
    updater: (value: T) => Effect.Effect<T>,
  ): Effect.Effect<void, never, never> {
    return pipe(
      this,
      notifyAllDependents(
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
      ),
      Observable.withSpan(this, "Signal.updateValue", {
        captureStackTrace: true,
      }),
    );
  }
}

export type Value<S extends Signal<unknown>> = Effect.Effect.Success<
  ReturnType<S["peek"]>
>;

export const make = <T>(value: T, options?: Observable.ObservableOptions) =>
  new Signal(value, options ?? {});
