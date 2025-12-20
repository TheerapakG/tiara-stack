import { Context, Effect, pipe, Scope, STM, TSet } from "effect";
import { Observable } from "../observability";
import { DependencySignal } from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import { fromDependent, SignalContext } from "./signalContext";
import * as SignalService from "./signalService";

export class SideEffect<R = never> implements DependentSignal {
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: Effect.Effect<unknown, unknown, R | SignalContext>;
  private _context: Context.Context<R>;
  private _dependencies: TSet.TSet<DependencySignal>;

  constructor(
    effect: Effect.Effect<unknown, unknown, R | SignalContext>,
    context: Context.Context<R>,
    dependencies: TSet.TSet<DependencySignal>,
    options: Observable.ObservableOptions,
  ) {
    this._effect = effect;
    this._context = context;
    this._dependencies = dependencies;
    this[Observable.ObservableSymbol] = options;
  }

  runOnce(): Effect.Effect<void, never, SignalService.SignalService> {
    return SignalService.enqueueRunTracked(
      new SignalService.RunTrackedRequest({
        effect: pipe(
          this._effect,
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

  getReferenceForDependency(): STM.STM<
    WeakRef<DependentSignal> | DependentSignal,
    never,
    never
  > {
    return STM.succeed(this);
  }

  notify(): Effect.Effect<unknown, never, SignalService.SignalService> {
    return pipe(
      this.clearDependencies(),
      Effect.andThen(this.runOnce()),
      Observable.withSpan(this, "SideEffect.notify", {
        captureStackTrace: true,
      }),
    );
  }

  cleanup() {
    return pipe(
      Effect.sync(() => {
        this._effect = Effect.void;
      }),
      Effect.andThen(this.clearDependencies()),
      Observable.withSpan(this, "SideEffect.cleanup", {
        captureStackTrace: true,
      }),
    );
  }
}

export const makeWithContext = <R = never>(
  effect: Effect.Effect<unknown, unknown, R>,
  context: Context.Context<NoInfer<Exclude<R, SignalContext>>>,
  options?: Observable.ObservableOptions,
): Effect.Effect<
  SideEffect<Exclude<R, SignalContext>>,
  never,
  Scope.Scope | SignalService.SignalService
> =>
  pipe(
    Effect.acquireRelease(
      pipe(
        TSet.empty<DependencySignal>(),
        Effect.map(
          (dependencies) =>
            new SideEffect<Exclude<R, SignalContext>>(
              effect as Effect.Effect<
                unknown,
                unknown,
                SignalContext | Exclude<R, SignalContext>
              >,
              context,
              dependencies,
              options ?? {},
            ),
        ),
        Effect.tap((sideEffect) => sideEffect.runOnce()),
      ),
      (sideEffect) => sideEffect.cleanup(),
    ),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "SideEffect.makeWithContext",
      {
        captureStackTrace: true,
      },
    ),
  );

export const mapEffectWithContext =
  <A, E1, R1, B, E2, R2>(
    mapper: (
      effect: Effect.Effect<A, E1, R1 | SignalContext>,
    ) => Effect.Effect<B, E2, R2>,
    context: Context.Context<NoInfer<Exclude<R2, SignalContext>>>,
    options?: Observable.ObservableOptions,
  ) =>
  <E3, R3>(signal: Effect.Effect<Effect.Effect<A, E1, R1>, E3, R3>) =>
    pipe(
      signal,
      Effect.flatMap((signal) =>
        makeWithContext(pipe(signal, mapper), context, options),
      ),
    );

export const tapWithContext =
  <A, X, R1>(
    mapper: (value: A) => X,
    context: Context.Context<
      NoInfer<
        Exclude<
          | R1
          | ([X] extends [Effect.Effect<infer _A2, infer _E2, infer R2>]
              ? R2
              : never),
          SignalContext
        >
      >
    >,
    options?: Observable.ObservableOptions,
  ) =>
  <E1, E2, R2>(signal: Effect.Effect<Effect.Effect<A, E1, R1>, E2, R2>) =>
    pipe(
      signal,
      mapEffectWithContext(
        Effect.tap(mapper) as (
          effect: Effect.Effect<A, E1, R1 | SignalContext>,
        ) => Effect.Effect<
          A,
          unknown,
          | R1
          | ([X] extends [Effect.Effect<infer _A2, infer _E2, infer R2>]
              ? R2
              : never)
          | SignalContext
        >,
        context,
        options,
      ),
    );

export const make = (
  effect: Effect.Effect<unknown, unknown, SignalContext>,
  options?: Observable.ObservableOptions,
): Effect.Effect<
  SideEffect<never>,
  never,
  Scope.Scope | SignalService.SignalService
> => makeWithContext(effect, Context.empty(), options);

export const mapEffect =
  <A, E1, R1, B, E2>(
    mapper: (
      effect: Effect.Effect<A, E1, R1 | SignalContext>,
    ) => Effect.Effect<B, E2, SignalContext>,
    options?: Observable.ObservableOptions,
  ) =>
  <E3, R3>(signal: Effect.Effect<Effect.Effect<A, E1, R1>, E3, R3>) =>
    pipe(signal, mapEffectWithContext(mapper, Context.empty(), options));

export const tap =
  <A, X>(
    mapper: (
      value: A,
    ) => [X] extends [Effect.Effect<infer _A3, infer _E3, infer R3>]
      ? [R3] extends [never]
        ? X
        : never
      : X,
    options?: Observable.ObservableOptions,
  ) =>
  <E1, E2, R2>(
    signal: Effect.Effect<Effect.Effect<A, E1, SignalContext>, E2, R2>,
  ) =>
    pipe(
      signal,
      tapWithContext<A, X, SignalContext>(
        mapper,
        Context.empty() as Context.Context<unknown>,
        options,
      ),
    );
