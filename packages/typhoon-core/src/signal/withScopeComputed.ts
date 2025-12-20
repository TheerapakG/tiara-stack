import {
  Effect,
  Effectable,
  Exit,
  Function,
  flow,
  Match,
  Option,
  TRef,
  TQueue,
  TSet,
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
import * as SignalContext from "./signalContext";
import * as SignalService from "./signalService";

export class WithScopeComputed<A = never, E = never, R = never>
  extends Effectable.Class<
    A,
    E,
    R | SignalContext.SignalContext | SignalService.SignalService
  >
  implements DependentSignal, DependencySignal<A, E, R>
{
  readonly [DependencySymbol]: DependencySignal<A, E, R> = this;
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: Effect.Effect<A, E, R | SignalContext.SignalContext>;
  private _reference: WeakRef<WithScopeComputed<A, E, R>>;
  private _isScopeClosed: TRef.TRef<boolean>;
  private _queue: TQueue.TQueue<Exit.Exit<A, E>>;
  private _dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>;
  private _dependencies: TSet.TSet<DependencySignal>;

  constructor(
    effect: Effect.Effect<A, E, R | SignalContext.SignalContext>,
    isScopeClosed: TRef.TRef<boolean>,
    queue: TQueue.TQueue<Exit.Exit<A, E>>,
    dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>,
    dependencies: TSet.TSet<DependencySignal>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._effect = effect;
    this._reference = new WeakRef(this);
    this._isScopeClosed = isScopeClosed;
    this._queue = queue;
    this._dependents = dependents;
    this._dependencies = dependencies;
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

  addDependency(dependency: DependencySignal) {
    return pipe(
      TRef.get(this._isScopeClosed),
      STM.flatMap((isClosed) =>
        isClosed ? STM.void : TSet.add(this._dependencies, dependency),
      ),
    );
  }

  removeDependency(dependency: DependencySignal) {
    return TSet.remove(this._dependencies, dependency);
  }

  clearDependencies() {
    return pipe(
      TSet.forEach(this._dependencies, (dependency) =>
        dependency.removeDependent(this),
      ),
      STM.zipRight(TSet.removeIf(this._dependencies, () => true)),
    );
  }

  getDependencies(): STM.STM<DependencySignal[], never, never> {
    return pipe(
      TRef.get(this._isScopeClosed),
      STM.flatMap((isClosed) =>
        isClosed ? STM.succeed([]) : TSet.toArray(this._dependencies),
      ),
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
    A,
    E,
    R | SignalContext.SignalContext | SignalService.SignalService
  > {
    return pipe(
      SignalContext.bindDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "WithScopeComputed.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<
    A,
    E,
    R | SignalContext.SignalContext | SignalService.SignalService
  > {
    return this.value();
  }

  peek(): Effect.Effect<A, E, R | SignalService.SignalService> {
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
              STM.all({
                queue: TQueue.peekOption(this._queue),
                context: STM.context<R>(),
              }),
              STM.commit,
              Effect.flatMap(({ queue, context }) =>
                pipe(
                  queue,
                  Option.match({
                    onSome: Function.identity,
                    onNone: () =>
                      pipe(
                        SignalService.enqueueRunTracked(
                          new SignalService.RunTrackedRequest({
                            effect: pipe(
                              this._effect,
                              Effect.exit,
                              Effect.tap((exit) =>
                                pipe(
                                  TQueue.offer(this._queue, exit),
                                  STM.commit,
                                ),
                              ),
                              Effect.flatten,
                              Effect.provide(context),
                            ),
                            ctx: SignalContext.fromDependent(this),
                          }),
                        ),
                      ),
                  }),
                ),
              ),
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

  reset(): STM.STM<void, never, never> {
    return pipe(
      TQueue.takeAll(this._queue),
      STM.unlessSTM(TRef.get(this._isScopeClosed)),
      STM.asVoid,
    );
  }

  getReferenceForDependency(): STM.STM<
    WeakRef<DependentSignal> | DependentSignal,
    never,
    never
  > {
    return STM.succeed(this._reference);
  }

  notify(): Effect.Effect<unknown, never, never> {
    return pipe(
      this.clearDependencies(),
      STM.zipRight(this.reset()),
      STM.unlessSTM(TRef.get(this._isScopeClosed)),
      STM.commit,
      Observable.withSpan(this, "WithScopeComputed.notify", {
        captureStackTrace: true,
      }),
    );
  }

  recompute(): Effect.Effect<void, never, SignalService.SignalService> {
    return pipe(
      this,
      notifyAllDependents(() => this.reset()),
      Effect.unlessEffect(pipe(TRef.get(this._isScopeClosed), STM.commit)),
      Observable.withSpan(this, "WithScopeComputed.recompute", {
        captureStackTrace: true,
      }),
    );
  }

  reconcile(): STM.STM<void, never, never> {
    return STM.void;
  }

  cleanup(): Effect.Effect<void, never, never> {
    return pipe(
      this.clearDependencies(),
      STM.zipRight(TQueue.takeAll(this._queue)),
      STM.commit,
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
  WithScopeComputed<A, E, Exclude<R, SignalContext.SignalContext>>,
  never,
  Scope.Scope
> =>
  pipe(
    STM.all({
      isScopeClosed: TRef.make(false),
      queue: TQueue.sliding<Exit.Exit<A, E>>(1),
      dependents: TSet.empty<WeakRef<DependentSignal> | DependentSignal>(),
      dependencies: TSet.empty<DependencySignal>(),
    }),
    STM.let(
      "computed",
      ({ isScopeClosed, queue, dependents, dependencies }) =>
        new WithScopeComputed<A, E, Exclude<R, SignalContext.SignalContext>>(
          effect as Effect.Effect<
            A,
            E,
            Exclude<R, SignalContext.SignalContext>
          >,
          isScopeClosed,
          queue,
          dependents,
          dependencies,
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
  WithScopeComputed<A, E1, Exclude<R1, SignalContext.SignalContext>>,
  E2,
  R2 | Scope.Scope
> =>
  pipe(
    signal,
    Effect.flatMap((signal) => make(signal, options)),
  );
