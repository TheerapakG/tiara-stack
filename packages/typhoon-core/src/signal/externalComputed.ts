import { Effect, Effectable, HashSet, pipe } from "effect";
import { Observable } from "../observability";
import {
  DependencySignal,
  DependencySymbol,
  getDependentsUpdateOrder,
} from "./dependencySignal";
import { DependentSignal } from "./dependentSignal";
import { bindScopeDependency, SignalContext } from "./signalContext";
import * as SignalService from "./signalService";

export interface ExternalSource<T> {
  poll: () => Effect.Effect<T, never, never>;
  emit: (
    onEmit: (
      value: T,
    ) => Effect.Effect<void, never, SignalService.SignalService>,
  ) => Effect.Effect<void, never, never>;
  start: () => Effect.Effect<void, never, never>;
  stop: () => Effect.Effect<void, never, never>;
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
  private _dependents: HashSet.HashSet<
    WeakRef<DependentSignal> | DependentSignal
  >;
  private _emitting: boolean;
  private _source: ExternalSource<T>;

  constructor(
    initial: T,
    source: ExternalSource<T>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._value = initial;
    this._source = source;
    this._dependents = HashSet.empty();
    this._emitting = false;
    this[Observable.ObservableSymbol] = options;
  }

  addDependent(dependent: WeakRef<DependentSignal> | DependentSignal) {
    return Effect.sync(() => {
      this._dependents = HashSet.add(this._dependents, dependent);
    });
  }

  removeDependent(dependent: WeakRef<DependentSignal> | DependentSignal) {
    return Effect.sync(() => {
      this._dependents = HashSet.remove(this._dependents, dependent);
    });
  }

  clearDependents() {
    return Effect.sync(() => {
      HashSet.forEach(this._dependents, (dependent) =>
        dependent instanceof WeakRef
          ? dependent.deref()?.removeDependency(this)
          : dependent.removeDependency(this),
      );
      this._dependents = HashSet.empty();
    });
  }

  getDependents(): Effect.Effect<
    (WeakRef<DependentSignal> | DependentSignal)[],
    never,
    never
  > {
    return Effect.sync(() => HashSet.toValues(this._dependents));
  }

  valueLocal(): Effect.Effect<T, never, SignalContext> {
    return pipe(
      bindScopeDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "ExternalComputed.valueLocal", {
        captureStackTrace: true,
      }),
    );
  }

  value(): Effect.Effect<
    T,
    never,
    SignalContext | SignalService.SignalService
  > {
    return pipe(
      SignalContext,
      Effect.flatMap((signalContext) =>
        SignalService.SignalService.enqueueRunTracked(
          new SignalService.RunTrackedRequest({
            effect: this.valueLocal(),
            ctx: signalContext,
          }),
        ),
      ),
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
    return pipe(
      SignalService.SignalService.enqueueNotify(
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
      ),
      Observable.withSpan(this, "ExternalComputed.emit", {
        captureStackTrace: true,
      }),
    );
  }

  reconcile(): Effect.Effect<void, never, never> {
    return pipe(
      getDependentsUpdateOrder(this),
      Effect.map((dependents) =>
        dependents.some((d) => !(d instanceof WeakRef)),
      ),
      Effect.flatMap((watched) => this._maybeSetEmitting(watched)),
      Observable.withSpan(this, "ExternalComputed.reconcile", {
        captureStackTrace: true,
      }),
    );
  }

  private _maybeSetEmitting(
    watched: boolean,
  ): Effect.Effect<void, never, never> {
    return pipe(
      Effect.suspend(() => {
        if (watched && !this._emitting) {
          return pipe(
            this._source.start(),
            Effect.tap(() => Effect.sync(() => (this._emitting = true))),
          );
        }
        if (!watched && this._emitting) {
          return pipe(
            this._source.stop(),
            Effect.tap(() => Effect.sync(() => (this._emitting = false))),
          );
        }
        return Effect.void;
      }),
    );
  }
}

export const make = <T>(
  source: ExternalSource<T>,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    source.poll(),
    Effect.map(
      (initial) => new ExternalComputed(initial, source, options ?? {}),
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
