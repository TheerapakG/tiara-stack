import { Effect, Effectable, Equal, pipe, STM, TSet, TRef } from "effect";
import { Observable } from "../observability";
import {
  DependencySignal,
  DependencySymbol,
  buildDependentsSnapshot,
  getDependentsUpdateOrder,
} from "./dependencySignal";
import { DependentSignal } from "./dependentSignal";
import * as SignalService from "./signalService";
import * as SignalContext from "./signalContext";

export interface ExternalSource<T> {
  poll: () => STM.STM<T, never, never>;
  emit: (
    onEmit: (
      value: T,
    ) => Effect.Effect<void, never, SignalService.SignalService>,
  ) => STM.STM<void, never, never>;
  start: () => STM.STM<void, never, never>;
  stop: () => STM.STM<void, never, never>;
}

export class ExternalComputed<T = unknown>
  extends Effectable.Class<
    T,
    never,
    SignalContext.SignalContext | SignalService.SignalService
  >
  implements DependencySignal<T, never, never>
{
  readonly [DependencySymbol]: DependencySignal<T, never, never> = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _value: TRef.TRef<T>;
  private _dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>;
  private _emitting: TRef.TRef<boolean>;
  private _source: ExternalSource<T>;
  private _lastValue: TRef.TRef<T>;

  constructor(
    initial: TRef.TRef<T>,
    source: ExternalSource<T>,
    emitting: TRef.TRef<boolean>,
    dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>,
    options: Observable.ObservableOptions,
    lastValue: TRef.TRef<T>,
  ) {
    super();
    this._value = initial;
    this._source = source;
    this._dependents = dependents;
    this._emitting = emitting;
    this._lastValue = lastValue;
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
    TSet.TSet<WeakRef<DependentSignal> | DependentSignal>,
    never,
    never
  > {
    return STM.succeed(this._dependents);
  }

  value(): Effect.Effect<
    T,
    never,
    SignalContext.SignalContext | SignalService.SignalService
  > {
    return pipe(
      SignalContext.bindDependency(this),
      STM.commit,
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "ExternalComputed.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<
    T,
    never,
    SignalContext.SignalContext | SignalService.SignalService
  > {
    return this.value();
  }

  peek(): Effect.Effect<T, never, never> {
    return pipe(
      STM.Do,
      STM.bind("value", () => TRef.get(this._value)),
      STM.bind("last", ({ value }) => TRef.getAndSet(this._lastValue, value)),
      STM.tap(({ value, last }) =>
        STM.when(() => Equal.equals(last, value))(
          SignalContext.markUnchanged(this),
        ),
      ),
      STM.map(({ value }) => value),
      STM.commit,
      Observable.withSpan(this, "ExternalComputed.peek", {
        captureStackTrace: true,
      }),
    );
  }

  handleEmit(
    value: T,
  ): Effect.Effect<void, never, SignalService.SignalService> {
    return pipe(
      Effect.log("enqueueing notify", value),
      Effect.andThen(
        SignalService.enqueueNotify(
          new SignalService.NotifyRequest({
            signal: this,
            beforeNotify: (watched) =>
              pipe(
                this._maybeSetEmitting(watched),
                STM.zipRight(TRef.set(this._value, value)),
                STM.commit,
                Effect.andThen(Effect.log("notified", value)),
              ),
          }),
        ),
      ),
    );
  }

  reconcile(): STM.STM<void, never, never> {
    return pipe(
      buildDependentsSnapshot(this),
      STM.flatMap((dependentsSnapshot) =>
        getDependentsUpdateOrder(dependentsSnapshot, this),
      ),
      STM.map((dependents) => dependents.some((d) => !(d instanceof WeakRef))),
      STM.flatMap((watched) => this._maybeSetEmitting(watched)),
    );
  }

  private _maybeSetEmitting(watched: boolean): STM.STM<void, never, never> {
    return pipe(
      TRef.get(this._emitting),
      STM.flatMap((emitting) => {
        if (watched && !emitting) {
          return pipe(
            this._source.start(),
            STM.tap(() => TRef.set(this._emitting, true)),
          );
        }
        if (!watched && emitting) {
          return pipe(
            this._source.stop(),
            STM.tap(() => TRef.set(this._emitting, false)),
          );
        }
        return STM.void;
      }),
    );
  }
}

export const makeSTM = <T>(
  source: ExternalSource<T>,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    STM.Do,
    STM.bind("initialValue", () => source.poll()),
    STM.bind("initial", ({ initialValue }) => TRef.make(initialValue)),
    STM.bind("lastValue", ({ initialValue }) => TRef.make(initialValue)),
    STM.bind("emitting", () => TRef.make(false)),
    STM.bind("dependents", () =>
      TSet.empty<WeakRef<DependentSignal> | DependentSignal>(),
    ),
    STM.map(
      ({ initial, lastValue, emitting, dependents }) =>
        new ExternalComputed(
          initial,
          source,
          emitting,
          dependents,
          options ?? {},
          lastValue,
        ),
    ),
    STM.tap((signal) => source.emit((value) => signal.handleEmit(value))),
  );

export const make = <T>(
  source: ExternalSource<T>,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    makeSTM(source, options),
    STM.commit,
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "ExternalComputed.make",
      {
        captureStackTrace: true,
      },
    ),
  );
