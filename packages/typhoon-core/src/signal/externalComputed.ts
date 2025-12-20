import { Effect, Effectable, pipe, STM, TSet, TRef } from "effect";
import { Observable } from "../observability";
import {
  DependencySignal,
  DependencySymbol,
  getDependentsUpdateOrder,
} from "./dependencySignal";
import { DependentSignal } from "./dependentSignal";
import { bindDependency, SignalContext } from "./signalContext";
import * as SignalService from "./signalService";

export interface ExternalSource<T> {
  poll: () => Effect.Effect<T, never, never>;
  emit: (
    onEmit: (
      value: T,
    ) => Effect.Effect<void, never, SignalService.SignalService>,
  ) => Effect.Effect<void, never, never>;
  start: () => STM.STM<void, never, never>;
  stop: () => STM.STM<void, never, never>;
}

export class ExternalComputed<T = unknown>
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
  private _emitting: TRef.TRef<boolean>;
  private _source: ExternalSource<T>;

  constructor(
    initial: T,
    source: ExternalSource<T>,
    emitting: TRef.TRef<boolean>,
    dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._value = initial;
    this._source = source;
    this._dependents = dependents;
    this._emitting = emitting;
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
      Observable.withSpan(this, "ExternalComputed.value", {
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
      Observable.withSpan(this, "ExternalComputed.peek", {
        captureStackTrace: true,
      }),
    );
  }

  handleEmit(
    value: T,
  ): Effect.Effect<void, never, SignalService.SignalService> {
    return SignalService.enqueueNotify(
      new SignalService.NotifyRequest({
        signal: this,
        beforeNotify: (watched) =>
          pipe(
            this._maybeSetEmitting(watched),
            Effect.andThen(
              Effect.sync(() => {
                this._value = value;
              }),
            ),
          ),
      }),
    );
  }

  reconcile(): STM.STM<void, never, never> {
    return pipe(
      getDependentsUpdateOrder(this),
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

export const make = <T>(
  source: ExternalSource<T>,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    Effect.all({
      initial: source.poll(),
      emitting: TRef.make(false),
      dependents: TSet.empty<WeakRef<DependentSignal> | DependentSignal>(),
    }),
    Effect.map(
      ({ initial, emitting, dependents }) =>
        new ExternalComputed(
          initial,
          source,
          emitting,
          dependents,
          options ?? {},
        ),
    ),
    Effect.tap((signal) => source.emit((value) => signal.handleEmit(value))),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "ExternalComputed.make",
      {
        captureStackTrace: true,
      },
    ),
  );
