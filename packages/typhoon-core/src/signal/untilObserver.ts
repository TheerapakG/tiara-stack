import {
  Effect,
  Effectable,
  Match,
  Option,
  Scope,
  TSet,
  TDeferred,
  STM,
  pipe,
  Context,
} from "effect";
import { RpcError, ValidationError } from "../error";
import { Observable } from "../observability";
import { DependencySignal } from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import { fromDependent, SignalContext } from "./signalContext";
import { RpcResult, Result } from "../schema";
import * as SignalService from "./signalService";

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

  private _dependencies: TSet.TSet<DependencySignal>;
  private _effect: Effect.Effect<A, E, R | SignalContext>;
  private _context: Context.Context<R>;
  private _value: TDeferred.TDeferred<Match.Types.WhenMatch<A, P>>;
  private _pattern: P;

  constructor(
    effect: Effect.Effect<A, E, R | SignalContext>,
    context: Context.Context<R>,
    value: TDeferred.TDeferred<Match.Types.WhenMatch<A, P>>,
    pattern: P,
    dependencies: TSet.TSet<DependencySignal>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._effect = effect;
    this._context = context;
    this._value = value;
    this._pattern = pattern;
    this._dependencies = dependencies;
    this[Observable.ObservableSymbol] = options;
  }

  runOnce(): Effect.Effect<void, never, SignalService.SignalService> {
    return SignalService.enqueueRunTracked(
      new SignalService.RunTrackedRequest({
        effect: pipe(
          this._effect,
          Effect.flatMap(
            (value) =>
              pipe(
                Match.value(value),
                Match.when(this._pattern, (matched) =>
                  pipe(TDeferred.succeed(this._value, matched), STM.commit),
                ),
                Match.orElse(() => Effect.void),
              ) as Effect.Effect<void, never, never>,
          ),
          Effect.catchAll(() => Effect.void),
          Effect.provide(this._context),
        ),
        ctx: fromDependent(this),
      }),
    );
  }

  addDependency(dependency: DependencySignal) {
    return TSet.add(this._dependencies, dependency);
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

  getDependencies() {
    return TSet.toArray(this._dependencies);
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

  getReferenceForDependency(): STM.STM<
    WeakRef<DependentSignal> | DependentSignal,
    never,
    never
  > {
    return STM.succeed(this);
  }

  notify(): Effect.Effect<unknown, never, SignalService.SignalService> {
    return pipe(
      TDeferred.poll(this._value),
      STM.zipLeft(this.clearDependencies()),
      STM.commit,
      Effect.andThen(
        Option.match({
          onSome: () => Effect.void,
          onNone: () => this.runOnce(),
        }),
      ),
      Observable.withSpan(this, "UntilObserver.notify", {
        captureStackTrace: true,
      }),
    );
  }
}

const make = <
  A = never,
  E = never,
  R = never,
  P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
>(
  effect: Effect.Effect<A, E, R | SignalContext>,
  pattern: P,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    Effect.all({
      context: Effect.context<Exclude<R, SignalContext>>(),
      value: TDeferred.make<Match.Types.WhenMatch<A, P>>(),
      dependencies: TSet.empty<DependencySignal>(),
    }),
    Effect.map(
      ({ context, value, dependencies }) =>
        new UntilObserver<A, E, Exclude<R, SignalContext>, P>(
          effect as Effect.Effect<
            A,
            E,
            Exclude<R, SignalContext> | SignalContext
          >,
          context,
          value,
          pattern,
          dependencies,
          options ?? {},
        ),
    ),
    Effect.tap((observer) => observer.runOnce()),
  );

export const observeUntil = <
  A = never,
  E = never,
  R = never,
  P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
>(
  effect: Effect.Effect<A, E, R | SignalContext>,
  pattern: P,
  options?: Observable.ObservableOptions,
): Effect.Effect<
  Match.Types.WhenMatch<A, P>,
  E,
  Exclude<R, SignalContext> | SignalService.SignalService
> =>
  pipe(
    make(effect, pattern, options ?? {}),
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
    Exclude<R, SignalContext> | R1 | SignalService.SignalService
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
    | Exclude<Exclude<R, SignalContext> | R1, Scope.Scope>
    | SignalService.SignalService
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
    | Exclude<Exclude<R, SignalContext> | R2, Scope.Scope>
    | SignalService.SignalService
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
    | Exclude<Exclude<R, SignalContext> | R2, Scope.Scope>
    | SignalService.SignalService
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
): Effect.Effect<
  A,
  E,
  Exclude<R, SignalContext> | SignalService.SignalService
> =>
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
  ): Effect.Effect<
    A,
    E | E2,
    Exclude<R, SignalContext> | R2 | SignalService.SignalService
  > =>
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
    | Exclude<Exclude<R, SignalContext> | R2, Scope.Scope>
    | SignalService.SignalService
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
