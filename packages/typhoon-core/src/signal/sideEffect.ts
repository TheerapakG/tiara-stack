import { Context, Effect, pipe, Scope, STM, TSet, TRef } from "effect";
import { Observable } from "../observability";
import { DependencySignal } from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import * as SignalService from "./signalService";

export class SideEffect<R = never> implements DependentSignal {
  readonly _tag = "SideEffect" as const;
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: TRef.TRef<Effect.Effect<unknown, unknown, R | SignalService.SignalService>>;
  private _context: Context.Context<R>;
  private _dependencies: TSet.TSet<DependencySignal<unknown, unknown, unknown>>;

  constructor(
    effect: TRef.TRef<Effect.Effect<unknown, unknown, R | SignalService.SignalService>>,
    context: Context.Context<R>,
    dependencies: TSet.TSet<DependencySignal<unknown, unknown, unknown>>,
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
          TRef.get(this._effect),
          STM.commit,
          Effect.flatten,
          Effect.catchAll(() => Effect.void),
          Effect.provide(this._context),
        ),
        signal: this,
      }),
    );
  }

  addDependency(dependency: DependencySignal<unknown, unknown, unknown>) {
    return TSet.add(this._dependencies, dependency);
  }

  removeDependency(dependency: DependencySignal<unknown, unknown, unknown>) {
    return TSet.remove(this._dependencies, dependency);
  }

  clearDependencies(): STM.STM<void, never, never> {
    return pipe(
      TSet.forEach(this._dependencies, (dependency) => dependency.removeDependent(this)),
      STM.zipRight(TSet.removeIf(this._dependencies, () => true)),
    );
  }

  getDependencies(): STM.STM<TSet.TSet<DependencySignal<unknown, unknown, unknown>>, never, never> {
    return STM.succeed(this._dependencies);
  }

  getReferenceForDependency(): STM.STM<WeakRef<DependentSignal> | DependentSignal, never, never> {
    return STM.succeed(this);
  }

  notify(): Effect.Effect<unknown, never, SignalService.SignalService> {
    return pipe(
      this.clearDependencies(),
      STM.commit,
      Effect.andThen(this.runOnce()),
      Observable.withSpan(this, "SideEffect.notify", {
        captureStackTrace: true,
      }),
    );
  }

  cleanup() {
    return pipe(
      TRef.set(this._effect, Effect.void),
      STM.zipRight(this.clearDependencies()),
      STM.commit,
      Observable.withSpan(this, "SideEffect.cleanup", {
        captureStackTrace: true,
      }),
    );
  }
}

export const makeWithContext = <R = never>(
  effect: Effect.Effect<unknown, unknown, R>,
  context: Context.Context<NoInfer<Exclude<R, SignalService.SignalService>>>,
  options?: Observable.ObservableOptions,
): Effect.Effect<
  SideEffect<Exclude<R, SignalService.SignalService>>,
  never,
  Scope.Scope | SignalService.SignalService
> =>
  pipe(
    Effect.acquireRelease(
      pipe(
        STM.all({
          effect: TRef.make(
            effect as Effect.Effect<
              unknown,
              unknown,
              SignalService.SignalService | Exclude<R, SignalService.SignalService>
            >,
          ),
          dependencies: TSet.empty<DependencySignal<unknown, unknown, unknown>>(),
        }),
        Effect.map(
          ({ effect, dependencies }) =>
            new SideEffect<Exclude<R, SignalService.SignalService>>(
              effect,
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
      {
        _tag: "SideEffect" as const,
        [Observable.ObservableSymbol]: options ?? {},
      },
      "SideEffect.makeWithContext",
      {
        captureStackTrace: true,
      },
    ),
  );

export const mapEffectWithContext =
  <A, E1, R1, B, E2, R2>(
    mapper: (
      effect: Effect.Effect<A, E1, R1 | SignalService.SignalService>,
    ) => Effect.Effect<B, E2, R2>,
    context: Context.Context<NoInfer<Exclude<R2, SignalService.SignalService>>>,
    options?: Observable.ObservableOptions,
  ) =>
  <E3, R3>(signal: Effect.Effect<Effect.Effect<A, E1, R1>, E3, R3>) =>
    pipe(
      signal,
      Effect.flatMap((signal) => makeWithContext(pipe(signal, mapper), context, options)),
    );

export const tapWithContext =
  <A, X, R1>(
    mapper: (value: A) => X,
    context: Context.Context<
      NoInfer<
        Exclude<
          R1 | ([X] extends [Effect.Effect<infer _A2, infer _E2, infer R2>] ? R2 : never),
          SignalService.SignalService
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
          effect: Effect.Effect<A, E1, R1 | SignalService.SignalService>,
        ) => Effect.Effect<
          A,
          unknown,
          | R1
          | ([X] extends [Effect.Effect<infer _A2, infer _E2, infer R2>] ? R2 : never)
          | SignalService.SignalService
        >,
        context,
        options,
      ),
    );

export const make = (
  effect: Effect.Effect<unknown, unknown, SignalService.SignalService>,
  options?: Observable.ObservableOptions,
): Effect.Effect<SideEffect<never>, never, Scope.Scope | SignalService.SignalService> =>
  makeWithContext(effect, Context.empty(), options);

export const mapEffect =
  <A, E1, R1, B, E2>(
    mapper: (
      effect: Effect.Effect<A, E1, R1 | SignalService.SignalService>,
    ) => Effect.Effect<B, E2, SignalService.SignalService>,
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
  <E1, E2, R2>(signal: Effect.Effect<Effect.Effect<A, E1, SignalService.SignalService>, E2, R2>) =>
    pipe(
      signal,
      tapWithContext<A, X, SignalService.SignalService>(
        mapper,
        Context.empty() as Context.Context<unknown>,
        options,
      ),
    );
