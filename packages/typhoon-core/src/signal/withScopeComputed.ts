import {
  Deferred,
  Effect,
  Effectable,
  Fiber,
  HashSet,
  Option,
  pipe,
  Ref,
  Scope,
} from "effect";
import { Observable } from "../observability";
import {
  DependencySignal,
  DependencySymbol,
  notifyAllDependents,
} from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import {
  bindScopeDependency,
  fromDependent,
  runAndTrackEffect,
  SignalContext,
} from "./signalContext";

export class WithScopeComputed<A = never, E = never, R = never>
  extends Effectable.Class<A, E, R | SignalContext>
  implements DependentSignal, DependencySignal<A, E, R>
{
  readonly [DependencySymbol]: DependencySignal<A, E, R> = this;
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: Effect.Effect<A, E, R | SignalContext>;
  private _value: Deferred.Deferred<A, E>;
  private _fiber: Option.Option<Fiber.Fiber<boolean, never>>;
  private _dependents: HashSet.HashSet<
    WeakRef<DependentSignal> | DependentSignal
  >;
  private _dependencies: HashSet.HashSet<DependencySignal>;
  private _reference: WeakRef<WithScopeComputed<A, E, R>>;
  private _isScopeClosed: Ref.Ref<boolean>;

  constructor(
    effect: Effect.Effect<A, E, R | SignalContext>,
    value: Deferred.Deferred<A, E>,
    isScopeClosed: Ref.Ref<boolean>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._effect = effect;
    this._value = value;
    this._fiber = Option.none();
    this._dependents = HashSet.empty();
    this._dependencies = HashSet.empty();
    this._reference = new WeakRef(this);
    this._isScopeClosed = isScopeClosed;
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

  addDependency(dependency: DependencySignal) {
    return pipe(
      Ref.get(this._isScopeClosed),
      Effect.flatMap((isClosed) =>
        isClosed
          ? Effect.void
          : Effect.sync(() => {
              this._dependencies = HashSet.add(this._dependencies, dependency);
            }),
      ),
    );
  }

  removeDependency(dependency: DependencySignal) {
    return Effect.sync(() => {
      this._dependencies = HashSet.remove(this._dependencies, dependency);
    });
  }

  clearDependencies() {
    return Effect.sync(() => {
      HashSet.forEach(this._dependencies, (dependency) =>
        dependency.removeDependent(this),
      );
      this._dependencies = HashSet.empty();
    });
  }

  getDependencies(): Effect.Effect<DependencySignal[], never, never> {
    return pipe(
      Ref.get(this._isScopeClosed),
      Effect.flatMap((isClosed) =>
        isClosed
          ? Effect.succeed([])
          : Effect.sync(() => HashSet.toValues(this._dependencies)),
      ),
    );
  }

  getDependents(): Effect.Effect<
    (WeakRef<DependentSignal> | DependentSignal)[],
    never,
    never
  > {
    return Effect.sync(() => HashSet.toValues(this._dependents));
  }

  get value(): Effect.Effect<A, E, R | SignalContext> {
    return pipe(
      bindScopeDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "WithScopeComputed.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<A, E, R | SignalContext> {
    return this.value;
  }

  peek(): Effect.Effect<A, E, R> {
    return pipe(
      Ref.get(this._isScopeClosed),
      Effect.flatMap((isClosed) =>
        isClosed
          ? Deferred.await(this._value)
          : pipe(
              Effect.Do,
              Effect.bind("fiber", () =>
                pipe(
                  this._fiber,
                  Option.match({
                    onSome: (fiber) => Effect.succeed(fiber),
                    onNone: () =>
                      pipe(
                        fromDependent(this),
                        runAndTrackEffect(this._effect),
                        Effect.exit,
                        Effect.flatMap((value) =>
                          Deferred.complete(this._value, value),
                        ),
                        Effect.forkDaemon,
                      ),
                  }),
                ),
              ),
              Effect.tap(({ fiber }) => {
                this._fiber = Option.some(fiber);
              }),
              Effect.flatMap(() => Deferred.await(this._value)),
            ),
      ),
      Observable.withSpan(this, "WithScopeComputed.peek", {
        captureStackTrace: true,
      }),
    );
  }

  reset(): Effect.Effect<void, never, never> {
    return pipe(
      Effect.all([
        pipe(
          Deferred.make<A, E>(),
          Effect.map((value) => {
            this._value = value;
          }),
        ),
        pipe(
          Effect.succeed(this._fiber),
          Effect.tap(() => {
            this._fiber = Option.none();
          }),
          Effect.flatMap((fiber) =>
            pipe(
              fiber,
              Option.match({
                onSome: (fiber) => Fiber.interrupt(fiber),
                onNone: () => Effect.void,
              }),
            ),
          ),
        ),
      ]),
      Effect.unlessEffect(Ref.get(this._isScopeClosed)),
      Observable.withSpan(this, "WithScopeComputed.reset", {
        captureStackTrace: true,
      }),
    );
  }

  getReferenceForDependency(): Effect.Effect<
    WeakRef<DependentSignal> | DependentSignal,
    never,
    never
  > {
    return Effect.sync(() => this._reference);
  }

  notify(): Effect.Effect<unknown, never, never> {
    return pipe(
      this.clearDependencies(),
      Effect.andThen(this.reset()),
      Effect.unlessEffect(Ref.get(this._isScopeClosed)),
      Observable.withSpan(this, "WithScopeComputed.notify", {
        captureStackTrace: true,
      }),
    );
  }

  recompute(): Effect.Effect<void, never, never> {
    return pipe(
      this,
      notifyAllDependents(() => this.reset()),
      Effect.unlessEffect(Ref.get(this._isScopeClosed)),
      Observable.withSpan(this, "WithScopeComputed.recompute", {
        captureStackTrace: true,
      }),
    );
  }

  reconcile(): Effect.Effect<void, never, never> {
    return Effect.void;
  }

  cleanup(): Effect.Effect<void, never, never> {
    return pipe(
      this._fiber,
      Effect.transposeMapOption((fiber) => Fiber.interrupt(fiber)),
      Effect.andThen(() => this.clearDependencies()),
      Effect.andThen(() => Deferred.interrupt(this._value)),
      Effect.ignore,
      Observable.withSpan(this, "WithScopeComputed.cleanup", {
        captureStackTrace: true,
      }),
    );
  }
}

export type Success<S extends WithScopeComputed<unknown, unknown, unknown>> =
  Effect.Effect.Success<ReturnType<S["peek"]>>;

export type Error<S extends WithScopeComputed<unknown, unknown, unknown>> =
  Effect.Effect.Error<ReturnType<S["peek"]>>;

export type Context<S extends WithScopeComputed<unknown, unknown, unknown>> =
  Effect.Effect.Context<ReturnType<S["peek"]>>;

export const make = <A = never, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: Observable.ObservableOptions,
): Effect.Effect<
  WithScopeComputed<A, E, Exclude<R, SignalContext>>,
  never,
  Scope.Scope
> =>
  pipe(
    Effect.all({
      isScopeClosed: Ref.make(false),
      value: Deferred.make<A, E>(),
    }),
    Effect.let(
      "computed",
      ({ isScopeClosed, value }) =>
        new WithScopeComputed<A, E, Exclude<R, SignalContext>>(
          effect as Effect.Effect<
            A,
            E,
            SignalContext | Exclude<R, SignalContext>
          >,
          value,
          isScopeClosed,
          options ?? {},
        ),
    ),
    Effect.flatMap(({ computed, isScopeClosed }) =>
      Effect.acquireRelease(Effect.succeed(computed), () =>
        pipe(Ref.set(isScopeClosed, true), Effect.andThen(computed.cleanup())),
      ),
    ),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "WithScopeComputed.make",
      {
        captureStackTrace: true,
      },
    ),
  );

export const wrap = <A = never, E1 = never, R1 = never, E2 = never, R2 = never>(
  signal: Effect.Effect<DependencySignal<A, E1, R1>, E2, R2>,
  options?: Observable.ObservableOptions,
): Effect.Effect<
  WithScopeComputed<A, E1, Exclude<R1, SignalContext>>,
  E2,
  R2 | Scope.Scope
> =>
  pipe(
    signal,
    Effect.flatMap((signal) => make(signal, options)),
  );
