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
import { Observable } from "../observability";
import { DependencySignal } from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import {
  fromDependent,
  runAndTrackEffect,
  SignalContext,
} from "./signalContext";

type PatternType<A, P extends Match.Types.PatternPrimitive<A>> =
  P extends Match.Types.PatternPrimitive<infer R> ? R : A;

class UntilObserver<
    A = never,
    E = never,
    P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
  >
  extends Effectable.Class<PatternType<A, P>, E, never>
  implements DependentSignal
{
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _dependencies: HashSet.HashSet<DependencySignal>;
  private _fiber: Deferred.Deferred<Fiber.Fiber<A, E>, never>;
  private _effect: Effect.Effect<A, E, SignalContext>;
  private _pattern: P;
  private _resolved: Ref.Ref<boolean>;
  private _currentFiber: Ref.Ref<Option.Option<Fiber.Fiber<A, E>>>;
  private _valueDeferred: Ref.Ref<
    Option.Option<Deferred.Deferred<PatternType<A, P>, E>>
  >;

  constructor(
    fiber: Deferred.Deferred<Fiber.Fiber<A, E>, never>,
    effect: Effect.Effect<A, E, SignalContext>,
    pattern: P,
    resolved: Ref.Ref<boolean>,
    currentFiber: Ref.Ref<Option.Option<Fiber.Fiber<A, E>>>,
    valueDeferred: Ref.Ref<
      Option.Option<Deferred.Deferred<PatternType<A, P>, E>>
    >,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._dependencies = HashSet.empty();
    this._fiber = fiber;
    this._effect = effect;
    this._pattern = pattern;
    this._resolved = resolved;
    this._currentFiber = currentFiber;
    this._valueDeferred = valueDeferred;
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
      Effect.bind("deferred", () => Deferred.make<Fiber.Fiber<A, E>, never>()),
      Effect.bind("resolved", () => Ref.make(false)),
      Effect.bind("currentFiber", () =>
        Ref.make<Option.Option<Fiber.Fiber<A, E>>>(Option.none()),
      ),
      Effect.bind("valueDeferred", () =>
        Ref.make<Option.Option<Deferred.Deferred<PatternType<A, P>, E>>>(
          Option.none(),
        ),
      ),
      Effect.let(
        "observer",
        ({ deferred, resolved, currentFiber, valueDeferred }) =>
          new UntilObserver(
            deferred,
            effect as Effect.Effect<A, E, SignalContext>,
            pattern,
            resolved,
            currentFiber,
            valueDeferred,
            options,
          ),
      ),
      Effect.tap(({ deferred, observer, currentFiber }) =>
        pipe(
          fromDependent(observer),
          runAndTrackEffect(observer._effect),
          Effect.forkDaemon,
          Effect.flatMap((fiber) => {
            Ref.set(currentFiber, Option.some(fiber));
            return pipe(
              Deferred.succeed(deferred, fiber),
              Effect.tap(() =>
                pipe(observer.checkAndResolve(fiber), Effect.forkDaemon),
              ),
            );
          }),
        ),
      ),
      Effect.map(({ observer }) => observer),
    );
  }

  private checkAndResolve(
    fiber: Fiber.Fiber<A, E>,
  ): Effect.Effect<void, never, never> {
    return pipe(
      Fiber.join(fiber),
      Effect.flatMap((result) => {
        const matchResult = pipe(
          Match.value(result),
          Match.when(this._pattern, (matched) => matched),
          Match.orElse(() => null),
        );

        if (matchResult !== null) {
          const resolvedValue = matchResult as PatternType<A, P>;
          return pipe(
            Ref.get(this._resolved),
            Effect.flatMap((resolved) =>
              resolved
                ? Effect.void
                : pipe(
                    Ref.set(this._resolved, true),
                    Effect.flatMap(() =>
                      pipe(
                        Ref.get(this._valueDeferred),
                        Effect.flatMap((valueDef) =>
                          pipe(
                            valueDef,
                            Option.match({
                              onSome: (def) =>
                                Deferred.succeed(def, resolvedValue),
                              onNone: () => Effect.void,
                            }),
                          ),
                        ),
                      ),
                    ),
                  ),
            ),
          );
        }
        return Effect.void;
      }),
      Effect.catchAll(() => Effect.void),
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

  commit(): Effect.Effect<PatternType<A, P>, E, never> {
    return this.value;
  }

  get value(): Effect.Effect<PatternType<A, P>, E, never> {
    return pipe(
      Effect.Do,
      Effect.bind("resolved", () => Ref.get(this._resolved)),
      Effect.flatMap(({ resolved }) =>
        resolved
          ? pipe(
              Effect.Do,
              Effect.bind("fiber", () => Deferred.await(this._fiber)),
              Effect.flatMap(({ fiber }) =>
                Fiber.join(fiber).pipe(
                  Effect.map((result) => result as PatternType<A, P>),
                ),
              ),
            )
          : pipe(
              Effect.Do,
              Effect.bind("valueDef", () =>
                pipe(
                  Ref.get(this._valueDeferred),
                  Effect.flatMap((valueDef) =>
                    pipe(
                      valueDef,
                      Option.match({
                        onSome: (def) => Effect.succeed(def),
                        onNone: () =>
                          pipe(
                            Deferred.make<PatternType<A, P>, E>(),
                            Effect.flatMap((def) =>
                              pipe(
                                Ref.set(this._valueDeferred, Option.some(def)),
                                Effect.map(() => def),
                              ),
                            ),
                          ),
                      }),
                    ),
                  ),
                ),
              ),
              Effect.flatMap(
                ({ valueDef }) =>
                  Deferred.await(valueDef) as Effect.Effect<
                    PatternType<A, P>,
                    E,
                    never
                  >,
              ),
            ),
      ),
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
      Effect.Do,
      Effect.bind("isResolved", () => Ref.get(this._resolved)),
      Effect.flatMap(({ isResolved }) =>
        isResolved
          ? this.clearDependencies()
          : pipe(
              Effect.all([
                this.clearDependencies(),
                pipe(
                  Effect.Do,
                  Effect.bind("oldFiber", () => Ref.get(this._currentFiber)),
                  Effect.tap(() =>
                    pipe(
                      fromDependent(this),
                      runAndTrackEffect(this._effect),
                      Effect.forkDaemon,
                      Effect.flatMap((newFiber) =>
                        pipe(
                          Ref.set(this._currentFiber, Option.some(newFiber)),
                          Effect.flatMap(() =>
                            Deferred.succeed(this._fiber, newFiber),
                          ),
                          Effect.tap(() => this.checkAndResolve(newFiber)),
                        ),
                      ),
                    ),
                  ),
                  Effect.flatMap(({ oldFiber }) =>
                    pipe(
                      oldFiber,
                      Option.match({
                        onSome: (fiber) => Fiber.interrupt(fiber),
                        onNone: () => Effect.void,
                      }),
                    ),
                  ),
                ),
              ]),
            ),
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
): Effect.Effect<PatternType<A, P>, E, Exclude<R, SignalContext>> =>
  pipe(
    UntilObserver.make(effect, pattern, options ?? {}),
    Effect.flatMap((observer) => observer.value),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "observeUntil",
      {
        captureStackTrace: true,
      },
    ),
  );

export const observeUntilScoped = <
  A = never,
  E = never,
  R = never,
  E2 = never,
  R2 = never,
  P extends Match.Types.PatternPrimitive<A> = Match.Types.PatternPrimitive<A>,
>(
  effect: Effect.Effect<DependencySignal<A, E, R>, E2, R2>,
  pattern: P,
  options?: Observable.ObservableOptions,
): Effect.Effect<PatternType<A, P>, E | E2, Exclude<R | R2, Scope.Scope>> =>
  pipe(
    effect,
    Effect.flatMap((signal) => observeUntil(signal, pattern, options)),
    Effect.scoped,
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "observeUntilScoped",
      {
        captureStackTrace: true,
      },
    ),
  );
