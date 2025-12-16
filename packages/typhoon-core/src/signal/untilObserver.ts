import {
  Deferred,
  Effect,
  Effectable,
  Fiber,
  HashSet,
  Match,
  Option,
  pipe,
  Ref,
  Scope,
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
    P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
  >
  extends Effectable.Class<Match.Types.WhenMatch<A, P>, never, never>
  implements DependentSignal
{
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _dependencies: HashSet.HashSet<DependencySignal>;
  private _effect: Effect.Effect<A, E, SignalContext>;
  private _value: Ref.Ref<
    Deferred.Deferred<Match.Types.WhenMatch<A, P>, never>
  >;
  private _fiber: Ref.Ref<Deferred.Deferred<Fiber.Fiber<A, E>>>;
  private _pattern: P;

  constructor(
    effect: Effect.Effect<A, E, SignalContext>,
    value: Ref.Ref<Deferred.Deferred<Match.Types.WhenMatch<A, P>, never>>,
    fiber: Ref.Ref<Deferred.Deferred<Fiber.Fiber<A, E>>>,
    pattern: P,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._dependencies = HashSet.empty();
    this._effect = effect;
    this._value = value;
    this._fiber = fiber;
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
      Effect.Do,
      Effect.bind("fiberDeferred", () =>
        Deferred.make<Fiber.Fiber<A, E>, never>(),
      ),
      Effect.bind("fiberDeferredRef", ({ fiberDeferred }) =>
        Ref.make(fiberDeferred),
      ),
      Effect.bind("valueDeferred", () =>
        Deferred.make<Match.Types.WhenMatch<A, P>, never>(),
      ),
      Effect.bind("valueDeferredRef", ({ valueDeferred }) =>
        Ref.make(valueDeferred),
      ),
      Effect.let(
        "observer",
        ({ fiberDeferredRef, valueDeferredRef }) =>
          new UntilObserver(
            effect as Effect.Effect<A, E, SignalContext>,
            valueDeferredRef,
            fiberDeferredRef,
            pattern,
            options,
          ),
      ),
      Effect.tap(({ fiberDeferredRef, observer }) =>
        pipe(
          UntilObserver.makeFiber(observer),
          Effect.tap((fiber) =>
            pipe(
              Ref.get(fiberDeferredRef),
              Effect.tap((fiberDeferred) =>
                Deferred.succeed(fiberDeferred, fiber),
              ),
            ),
          ),
        ),
      ),
      Effect.map(({ observer }) => observer),
    );
  }

  static makeFiber = <
    A = never,
    E = never,
    P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
  >(
    observer: UntilObserver<A, E, P>,
  ): Effect.Effect<Fiber.Fiber<A, E>, never, never> =>
    pipe(
      fromDependent(observer),
      runAndTrackEffect(observer._effect),
      Effect.tap(
        (value) =>
          pipe(
            Match.value(value),
            Match.when(observer._pattern, (matched) =>
              pipe(
                Ref.get(observer._value),
                Effect.tap(Deferred.succeed(matched)),
              ),
            ),
            Match.orElse(() => Effect.void),
          ) as Effect.Effect<void, never, never>,
      ),
      Effect.forkDaemon,
    );

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
      Ref.get(this._value),
      Effect.flatMap((valueDef) => Deferred.await(valueDef)),
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
      Ref.get(this._value),
      Effect.flatMap(Deferred.poll),
      Effect.flatMap(
        Option.match({
          onSome: () => this.clearDependencies(),
          onNone: () =>
            pipe(
              this.clearDependencies(),
              Effect.andThen(() =>
                pipe(
                  Deferred.make<Fiber.Fiber<A, E>, never>(),
                  Effect.flatMap((fiberDeferred) =>
                    Ref.getAndSet(this._fiber, fiberDeferred),
                  ),
                  Effect.flatMap(Deferred.await),
                  Effect.flatMap(Fiber.interrupt),
                ),
              ),
              Effect.andThen(() =>
                pipe(
                  UntilObserver.makeFiber(this),
                  Effect.tap((fiber) =>
                    pipe(
                      Ref.get(this._fiber),
                      Effect.tap((fiberDeferred) =>
                        Deferred.succeed(fiberDeferred, fiber),
                      ),
                    ),
                  ),
                ),
              ),
            ),
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
  effect: Effect.Effect<A, E, R>,
  pattern: P,
  options?: Observable.ObservableOptions,
): Effect.Effect<Match.Types.WhenMatch<A, P>, E, Exclude<R, SignalContext>> =>
  pipe(
    UntilObserver.make(effect, pattern, options ?? {}),
    Effect.flatMap((observer) => observer.value()),
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
    effect: Effect.Effect<Effect.Effect<A, E, R>, E1, R1>,
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
    effect: Effect.Effect<Effect.Effect<A, E, R>, E1, R1>,
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
  <A = never, E = never, E1 = never, R1 = never, E2 = never, R2 = never>(
    effect: Effect.Effect<
      Effect.Effect<RpcResult.RpcResult<A, E>, E1, R1>,
      E2,
      R2
    >,
  ): Effect.Effect<
    A,
    RpcError<E> | ValidationError | E1 | E2,
    Exclude<Exclude<R1, SignalContext> | R2, Scope.Scope>
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
  <A = never, E = never, E1 = never, R1 = never, E2 = never, R2 = never>(
    effect: Effect.Effect<
      Effect.Effect<RpcResult.RpcResult<Result.Result<unknown, A>, E>, E1, R1>,
      E2,
      R2
    >,
  ): Effect.Effect<
    A,
    RpcError<E> | ValidationError | E1 | E2,
    Exclude<Exclude<R1, SignalContext> | R2, Scope.Scope>
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
  effect: Effect.Effect<A, E, R>,
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
    effect: Effect.Effect<Effect.Effect<A, E, R>, E2, R2>,
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
    effect: Effect.Effect<Effect.Effect<A, E, R>, E2, R2>,
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
