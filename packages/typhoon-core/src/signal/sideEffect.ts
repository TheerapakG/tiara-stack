import { Context, Effect, Fiber, HashSet, Option, pipe, Scope } from "effect";
import { Observable } from "../observability";
import { DependencySignal } from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import {
  fromDependent,
  runAndTrackEffect,
  SignalContext,
} from "./signalContext";

export class SideEffect<R = never> implements DependentSignal {
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: Effect.Effect<unknown, unknown, R | SignalContext>;
  private _context: Context.Context<R>;
  private _fiber: Option.Option<Fiber.Fiber<unknown, unknown>>;
  private _dependencies: HashSet.HashSet<DependencySignal>;

  constructor(
    effect: Effect.Effect<unknown, unknown, R | SignalContext>,
    context: Context.Context<R>,
    options: Observable.ObservableOptions,
  ) {
    this._effect = effect;
    this._context = context;
    this._fiber = Option.none();
    this._dependencies = HashSet.empty();
    this[Observable.ObservableSymbol] = options;
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

  getReferenceForDependency(): Effect.Effect<
    WeakRef<DependentSignal> | DependentSignal,
    never,
    never
  > {
    return Effect.sync(() => this);
  }

  notify(): Effect.Effect<unknown, never, never> {
    return pipe(
      Effect.all([
        this.clearDependencies(),
        pipe(
          Effect.Do,
          Effect.let("fiber", () => this._fiber),
          Effect.bind("newFiber", () =>
            pipe(
              fromDependent(this),
              runAndTrackEffect(this._effect),
              Effect.forkDaemon,
            ),
          ),
          Effect.tap(({ newFiber }) => {
            this._fiber = Option.some(newFiber);
          }),
          Effect.flatMap(({ fiber }) =>
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
      Effect.provide(this._context),
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

export const make = (
  effect: Effect.Effect<unknown, unknown, SignalContext>,
  options?: Observable.ObservableOptions,
): Effect.Effect<SideEffect<never>, never, Scope.Scope> =>
  pipe(
    Effect.acquireRelease(
      pipe(
        Effect.succeed(
          new SideEffect<never>(effect, Context.empty(), options ?? {}),
        ),
        Effect.tap((sideEffect) => sideEffect.notify()),
      ),
      (sideEffect) => sideEffect.cleanup(),
    ),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "SideEffect.make",
      {
        captureStackTrace: true,
      },
    ),
  );

export const mapEffect =
  <A, E1, R1, B, E2>(
    mapper: (
      effect: Effect.Effect<A, E1, R1 | SignalContext>,
    ) => Effect.Effect<B, E2, SignalContext>,
    options?: Observable.ObservableOptions,
  ) =>
  <E3, R3>(signal: Effect.Effect<DependencySignal<A, E1, R1>, E3, R3>) =>
    pipe(
      signal,
      Effect.flatMap((signal) => make(pipe(signal, mapper), options)),
    );

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
  <E1, E2, R2>(signal: Effect.Effect<DependencySignal<A, E1, never>, E2, R2>) =>
    pipe(
      signal,
      mapEffect(
        Effect.tap(mapper) as (
          effect: Effect.Effect<A, E1, SignalContext>,
        ) => Effect.Effect<A, unknown, SignalContext>,
        options,
      ),
    );

export const makeWithContext = <R = never>(
  effect: Effect.Effect<unknown, unknown, R>,
  context: Context.Context<Exclude<R, SignalContext>>,
  options?: Observable.ObservableOptions,
): Effect.Effect<SideEffect<Exclude<R, SignalContext>>, never, Scope.Scope> =>
  pipe(
    Effect.acquireRelease(
      pipe(
        Effect.succeed(
          new SideEffect<Exclude<R, SignalContext>>(
            effect as Effect.Effect<
              unknown,
              unknown,
              SignalContext | Exclude<R, SignalContext>
            >,
            context,
            options ?? {},
          ),
        ),
        Effect.tap((sideEffect) => sideEffect.notify()),
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
    context: Context.Context<Exclude<R2, SignalContext>>,
    options?: Observable.ObservableOptions,
  ) =>
  <E3, R3>(signal: Effect.Effect<DependencySignal<A, E1, R1>, E3, R3>) =>
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
      Exclude<
        | R1
        | ([X] extends [Effect.Effect<infer _A2, infer _E2, infer R2>]
            ? R2
            : never),
        SignalContext
      >
    >,
    options?: Observable.ObservableOptions,
  ) =>
  <E1, E2, R2>(signal: Effect.Effect<DependencySignal<A, E1, R1>, E2, R2>) =>
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
