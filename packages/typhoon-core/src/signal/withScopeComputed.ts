import {
  Effect,
  Effectable,
  Exit,
  flow,
  HashSet,
  Match,
  Option,
  TRef,
  TQueue,
  TSemaphore,
  STM,
  Scope,
  pipe,
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
import * as SignalService from "./signalService";

export class WithScopeComputed<A = never, E = never, R = never>
  extends Effectable.Class<
    A,
    E,
    R | SignalContext | SignalService.SignalService
  >
  implements DependentSignal, DependencySignal<A, E, R>
{
  readonly [DependencySymbol]: DependencySignal<A, E, R> = this;
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: Effect.Effect<A, E, R | SignalContext>;
  private _dependents: HashSet.HashSet<
    WeakRef<DependentSignal> | DependentSignal
  >;
  private _dependencies: HashSet.HashSet<DependencySignal>;
  private _reference: WeakRef<WithScopeComputed<A, E, R>>;
  private _isScopeClosed: TRef.TRef<boolean>;
  private _queue: TQueue.TQueue<Exit.Exit<A, E>>;
  private _semaphore: TSemaphore.TSemaphore;

  constructor(
    effect: Effect.Effect<A, E, R | SignalContext>,
    isScopeClosed: TRef.TRef<boolean>,
    queue: TQueue.TQueue<Exit.Exit<A, E>>,
    semaphore: TSemaphore.TSemaphore,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._effect = effect;
    this._dependents = HashSet.empty();
    this._dependencies = HashSet.empty();
    this._reference = new WeakRef(this);
    this._isScopeClosed = isScopeClosed;
    this._queue = queue;
    this._semaphore = semaphore;
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
      TRef.get(this._isScopeClosed),
      STM.flatMap((isClosed) =>
        isClosed
          ? STM.void
          : STM.sync(() => {
              this._dependencies = HashSet.add(this._dependencies, dependency);
            }),
      ),
      STM.commit,
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
      TRef.get(this._isScopeClosed),
      STM.flatMap((isClosed) =>
        isClosed
          ? STM.succeed([])
          : STM.sync(() => HashSet.toValues(this._dependencies)),
      ),
      STM.commit,
    );
  }

  getDependents(): Effect.Effect<
    (WeakRef<DependentSignal> | DependentSignal)[],
    never,
    never
  > {
    return Effect.sync(() => HashSet.toValues(this._dependents));
  }

  valueLocal(): Effect.Effect<A, E, R | SignalContext> {
    return pipe(
      bindScopeDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "WithScopeComputed.value", {
        captureStackTrace: true,
      }),
    );
  }

  value(): Effect.Effect<
    A,
    E,
    R | SignalContext | SignalService.SignalService
  > {
    return pipe(
      Effect.all({
        context: Effect.context<R>(),
        signalContext: SignalContext,
      }),
      Effect.flatMap(({ context, signalContext }) =>
        SignalService.SignalService.enqueueRunTracked({
          effect: pipe(this.valueLocal(), Effect.provide(context)),
          ctx: signalContext,
        }),
      ),
      Observable.withSpan(this, "WithScopeComputed.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<
    A,
    E,
    R | SignalContext | SignalService.SignalService
  > {
    return this.value();
  }

  peek(): Effect.Effect<A, E, R> {
    return pipe(
      TRef.get(this._isScopeClosed),
      STM.commit,
      Effect.flatMap(
        flow(
          Match.value,
          Match.when(true, () =>
            pipe(TQueue.peek(this._queue), STM.commit, Effect.flatten),
          ),
          Match.when(false, () =>
            pipe(
              TQueue.peekOption(this._queue),
              STM.commit,
              Effect.flatMap(
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () =>
                    TSemaphore.withPermit(this._semaphore)(
                      pipe(
                        fromDependent(this),
                        runAndTrackEffect(this._effect),
                        Effect.exit,
                        Effect.tap((exit) =>
                          pipe(TQueue.offer(this._queue, exit), STM.commit),
                        ),
                      ),
                    ),
                }),
              ),
              Effect.flatten,
            ),
          ),
          Match.exhaustive,
        ),
      ),
      Observable.withSpan(this, "WithScopeComputed.peek", {
        captureStackTrace: true,
      }),
    );
  }

  reset(): Effect.Effect<void, never, never> {
    return pipe(
      TQueue.takeAll(this._queue),
      STM.asVoid,
      STM.unlessSTM(TRef.get(this._isScopeClosed)),
      STM.commit,
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
      Effect.unlessEffect(pipe(TRef.get(this._isScopeClosed), STM.commit)),
      Observable.withSpan(this, "WithScopeComputed.notify", {
        captureStackTrace: true,
      }),
    );
  }

  recompute(): Effect.Effect<void, never, never> {
    return pipe(
      this,
      notifyAllDependents(() => this.reset()),
      Effect.unlessEffect(pipe(TRef.get(this._isScopeClosed), STM.commit)),
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
      this.clearDependencies(),
      Effect.andThen(pipe(TQueue.takeAll(this._queue), STM.commit)),
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
    STM.all({
      isScopeClosed: TRef.make(false),
      queue: TQueue.sliding<Exit.Exit<A, E>>(1),
      semaphore: TSemaphore.make(1),
    }),
    STM.let(
      "computed",
      ({ isScopeClosed, queue, semaphore }) =>
        new WithScopeComputed<A, E, Exclude<R, SignalContext>>(
          effect as Effect.Effect<A, E, Exclude<R, SignalContext>>,
          isScopeClosed,
          queue,
          semaphore,
          options ?? {},
        ),
    ),
    STM.commit,
    Effect.flatMap(({ computed, isScopeClosed }) =>
      Effect.acquireRelease(Effect.succeed(computed), () =>
        pipe(
          TRef.set(isScopeClosed, true),
          STM.commit,
          Effect.andThen(computed.cleanup()),
        ),
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
  signal: Effect.Effect<Effect.Effect<A, E1, R1>, E2, R2>,
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
