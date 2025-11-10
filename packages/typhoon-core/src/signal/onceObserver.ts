import {
  Deferred,
  Effect,
  Effectable,
  Fiber,
  HashSet,
  pipe,
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

class OnceObserver<A = never, E = never>
  extends Effectable.Class<A, E, never>
  implements DependentSignal
{
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _dependencies: HashSet.HashSet<DependencySignal>;
  private _fiber: Deferred.Deferred<Fiber.Fiber<A, E>, never>;

  constructor(
    fiber: Deferred.Deferred<Fiber.Fiber<A, E>, never>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._dependencies = HashSet.empty();
    this._fiber = fiber;
    this[Observable.ObservableSymbol] = options;
  }

  static make<A = never, E = never, R = never>(
    effect: Effect.Effect<A, E, R | SignalContext>,
    options: Observable.ObservableOptions,
  ) {
    return pipe(
      Effect.Do,
      Effect.bind("deferred", () => Deferred.make<Fiber.Fiber<A, E>, never>()),
      Effect.let(
        "observer",
        ({ deferred }) => new OnceObserver(deferred, options),
      ),
      Effect.tap(({ deferred, observer }) =>
        pipe(
          fromDependent(observer),
          runAndTrackEffect(effect),
          Effect.forkDaemon,
          Effect.flatMap((fiber) => Deferred.succeed(deferred, fiber)),
        ),
      ),
      Effect.map(({ observer }) => observer),
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

  commit(): Effect.Effect<A, E, never> {
    return this.value;
  }

  get value(): Effect.Effect<A, E, never> {
    return pipe(
      Effect.Do,
      Effect.bind("fiber", () => Deferred.await(this._fiber)),
      Effect.flatMap(({ fiber }) => Fiber.join(fiber)),
      Observable.withSpan(this, "OnceObserver.value", {
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
      this.clearDependencies(),
      Observable.withSpan(this, "OnceObserver.notify", {
        captureStackTrace: true,
      }),
    );
  }
}

export const observeOnce = <A = never, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: Observable.ObservableOptions,
): Effect.Effect<A, E, Exclude<R, SignalContext>> =>
  pipe(
    OnceObserver.make(effect, options ?? {}),
    Effect.flatMap((observer) => observer),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "observeOnce",
      {
        captureStackTrace: true,
      },
    ),
  );

export const observeOnceScoped = <
  A = never,
  E = never,
  R = never,
  E2 = never,
  R2 = never,
>(
  effect: Effect.Effect<DependencySignal<A, E, R>, E2, R2 | Scope.Scope>,
  options?: Observable.ObservableOptions,
): Effect.Effect<A, E | E2, Exclude<R2, Scope.Scope>> =>
  pipe(
    Effect.scoped(
      pipe(
        effect,
        Effect.flatMap((signal) => observeOnce(signal.value, options)),
      ),
    ),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "observeOnceScoped",
      {
        captureStackTrace: true,
      },
    ),
  );
