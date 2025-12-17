import {
  Effect,
  Effectable,
  HashSet,
  Match,
  Option,
  Schedule,
  Scope,
  TDeferred,
  STM,
  pipe,
} from "effect";
import { RpcError, ValidationError } from "../error";
import { Observable } from "../observability";
import { DependencySignal } from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import {
  fromDependent,
  runAndTrackEffect,
  SignalContext,
} from "./signalContext";
import { RpcResult, Result } from "../schema";

class UntilObserver<
    A = never,
    E = never,
    R = never,
    P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
  >
  extends Effectable.Class<Match.Types.WhenMatch<A, P>, never, never>
  implements DependentSignal
{
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _dependencies: HashSet.HashSet<DependencySignal>;
  private _effect: Effect.Effect<A, E, R | SignalContext>;
  private _value: TDeferred.TDeferred<Match.Types.WhenMatch<A, P>>;
  private _runLatch: Effect.Latch;
  private _pattern: P;

  constructor(
    effect: Effect.Effect<A, E, R | SignalContext>,
    value: TDeferred.TDeferred<Match.Types.WhenMatch<A, P>>,
    runLatch: Effect.Latch,
    pattern: P,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._dependencies = HashSet.empty();
    this._effect = effect;
    this._value = value;
    this._runLatch = runLatch;
    this._pattern = pattern;
    this[Observable.ObservableSymbol] = options;
  }

  static make<
    A = never,
    E = never,
    R = never,
    P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
  >(
    effect: Effect.Effect<A, E, R | SignalContext>,
    pattern: P,
    options: Observable.ObservableOptions,
  ) {
    return pipe(
      Effect.all({
        valueDeferred: TDeferred.make<Match.Types.WhenMatch<A, P>>(),
        runLatch: Effect.makeLatch(true),
      }),
      Effect.map(
        ({ valueDeferred, runLatch }) =>
          new UntilObserver<A, E, Exclude<R, SignalContext>, P>(
            effect as Effect.Effect<
              A,
              E,
              Exclude<R, SignalContext> | SignalContext
            >,
            valueDeferred,
            runLatch,
            pattern,
            options,
          ),
      ),
      Effect.tap((observer) => observer.run()),
    );
  }

  private runOnce(): Effect.Effect<void, never, R> {
    return pipe(
      fromDependent(this),
      runAndTrackEffect(this._effect),
      Effect.flatMap(
        (value) =>
          pipe(
            Match.value(value),
            Match.when(this._pattern, (matched) =>
              pipe(TDeferred.succeed(this._value, matched), STM.commit),
            ),
            Match.orElse(() => Effect.void),
          ) as Effect.Effect<void, never, R>,
      ),
      Effect.catchAll(() => Effect.void),
    );
  }

  private run(): Effect.Effect<void, never, R | Scope.Scope> {
    return pipe(
      this._runLatch.await,
      Effect.andThen(this._runLatch.close),
      Effect.andThen(this.runOnce()),
      Effect.schedule(
        Schedule.recurWhileEffect(() =>
          pipe(TDeferred.poll(this._value), STM.map(Option.isNone), STM.commit),
        ),
      ),
      Effect.forkScoped,
      Observable.withSpan(this, "UntilObserver.run", {
        captureStackTrace: true,
      }),
    );
  }

  addDependency(dependency: DependencySignal) {
    return Effect.sync(() => {
      this._dependencies = HashSet.add(this._dependencies, dependency);
    });
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

  getDependencies() {
    return Effect.sync(() => HashSet.toValues(this._dependencies));
  }

  commit(): Effect.Effect<Match.Types.WhenMatch<A, P>, never, never> {
    return this.value();
  }

  value(): Effect.Effect<Match.Types.WhenMatch<A, P>, never, never> {
    return pipe(
      TDeferred.await(this._value),
      STM.commit,
      Observable.withSpan(this, "UntilObserver.value", {
        captureStackTrace: true,
      }),
    );
  }

  getReferenceForDependency(): Effect.Effect<
    WeakRef<DependentSignal> | DependentSignal,
    never,
    never
  > {
    return Effect.sync(() => this);
  }

  notify(): Effect.Effect<unknown, never, never> {
    return pipe(
      TDeferred.poll(this._value),
      STM.commit,
      Effect.flatMap(
        Option.match({
          onSome: () => this.clearDependencies(),
          onNone: () =>
            pipe(this.clearDependencies(), Effect.andThen(this._runLatch.open)),
        }),
      ),
      Observable.withSpan(this, "UntilObserver.notify", {
        captureStackTrace: true,
      }),
    );
  }
}

export const observeUntil = <
  A = never,
  E = never,
  R = never,
  P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
>(
  effect: Effect.Effect<A, E, R | SignalContext>,
  pattern: P,
  options?: Observable.ObservableOptions,
): Effect.Effect<Match.Types.WhenMatch<A, P>, E, Exclude<R, SignalContext>> =>
  pipe(
    UntilObserver.make(effect, pattern, options ?? {}),
    Effect.flatMap((observer) => observer.value()),
    Effect.scoped,
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "observeUntil",
      {
        captureStackTrace: true,
      },
    ),
  );

export const observeUntilSignal =
  <
    A = never,
    P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
  >(
    pattern: P,
    options?: Observable.ObservableOptions,
  ) =>
  <E = never, R = never, E1 = never, R1 = never>(
    effect: Effect.Effect<Effect.Effect<A, E, R | SignalContext>, E1, R1>,
  ): Effect.Effect<
    Match.Types.WhenMatch<A, P>,
    E | E1,
    Exclude<R, SignalContext> | R1
  > =>
    pipe(
      effect,
      Effect.flatMap((signal) => observeUntil(signal, pattern, options)),
      Observable.withSpan(
        { [Observable.ObservableSymbol]: options ?? {} },
        "observeUntilSignal",
        {
          captureStackTrace: true,
        },
      ),
    );

export const observeUntilScoped =
  <
    A = never,
    P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
  >(
    pattern: P,
    options?: Observable.ObservableOptions,
  ) =>
  <E = never, R = never, E1 = never, R1 = never>(
    effect: Effect.Effect<Effect.Effect<A, E, R | SignalContext>, E1, R1>,
  ): Effect.Effect<
    Match.Types.WhenMatch<A, P>,
    E | E1,
    Exclude<Exclude<R, SignalContext> | R1, Scope.Scope>
  > =>
    pipe(
      effect,
      observeUntilSignal(pattern, options),
      Effect.scoped,
      Observable.withSpan(
        { [Observable.ObservableSymbol]: options ?? {} },
        "observeUntilScoped",
        {
          captureStackTrace: true,
        },
      ),
    );

export const observeUntilRpcResolved =
  (options?: Observable.ObservableOptions) =>
  <A = never, E = never, R = never, E1 = never, E2 = never, R2 = never>(
    effect: Effect.Effect<
      Effect.Effect<RpcResult.RpcResult<A, E>, E1, R | SignalContext>,
      E2,
      R2
    >,
  ): Effect.Effect<
    A,
    RpcError<E> | ValidationError | E1 | E2,
    Exclude<Exclude<R, SignalContext> | R2, Scope.Scope>
  > =>
    pipe(
      effect,
      observeUntilScoped(RpcResult.isResolved, options),
      Effect.flatMap((result) => result.value),
      Observable.withSpan(
        { [Observable.ObservableSymbol]: options ?? {} },
        "observeUntilRpcResolved",
        {
          captureStackTrace: true,
        },
      ),
    );

export const observeUntilRpcResultResolved =
  (options?: Observable.ObservableOptions) =>
  <A = never, E = never, R = never, E1 = never, E2 = never, R2 = never>(
    effect: Effect.Effect<
      Effect.Effect<
        RpcResult.RpcResult<Result.Result<unknown, A>, E>,
        E1,
        R | SignalContext
      >,
      E2,
      R2
    >,
  ): Effect.Effect<
    A,
    RpcError<E> | ValidationError | E1 | E2,
    Exclude<Exclude<R, SignalContext> | R2, Scope.Scope>
  > =>
    pipe(
      effect,
      Effect.map(Effect.map(Result.fromRpcReturningResult(undefined))),
      observeUntilScoped(Result.isComplete, options),
      Effect.flatMap((result) => result.value),
      Observable.withSpan(
        { [Observable.ObservableSymbol]: options ?? {} },
        "observeUntilRpcResolved",
        {
          captureStackTrace: true,
        },
      ),
    );

export const observeOnce = <A = never, E = never, R = never>(
  effect: Effect.Effect<A, E, R | SignalContext>,
  options?: Observable.ObservableOptions,
): Effect.Effect<A, E, Exclude<R, SignalContext>> =>
  pipe(
    observeUntil(effect, Match.any as Match.Types.PatternPrimitive<A>, options),
    Effect.map((value) => value as A),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "observeOnce",
      {
        captureStackTrace: true,
      },
    ),
  );

export const observeOnceSignal =
  (options?: Observable.ObservableOptions) =>
  <A = never, E = never, R = never, E2 = never, R2 = never>(
    effect: Effect.Effect<Effect.Effect<A, E, R | SignalContext>, E2, R2>,
  ): Effect.Effect<A, E | E2, Exclude<R, SignalContext> | R2> =>
    pipe(
      effect,
      Effect.flatMap((innerEffect) => observeOnce(innerEffect, options)),
      Observable.withSpan(
        { [Observable.ObservableSymbol]: options ?? {} },
        "observeOnceSignal",
        {
          captureStackTrace: true,
        },
      ),
    );

export const observeOnceScoped =
  (options?: Observable.ObservableOptions) =>
  <A = never, E = never, R = never, E2 = never, R2 = never>(
    effect: Effect.Effect<Effect.Effect<A, E, R | SignalContext>, E2, R2>,
  ): Effect.Effect<
    A,
    E | E2,
    Exclude<Exclude<R, SignalContext> | R2, Scope.Scope>
  > =>
    pipe(
      effect,
      observeOnceSignal(options),
      Effect.scoped,
      Observable.withSpan(
        { [Observable.ObservableSymbol]: options ?? {} },
        "observeOnceScoped",
        {
          captureStackTrace: true,
        },
      ),
    );
