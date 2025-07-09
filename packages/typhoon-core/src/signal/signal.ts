import {
  Context,
  Deferred,
  Effect as E,
  Fiber,
  HashSet,
  Option,
  pipe,
} from "effect";

const DependencySymbol = Symbol("Typhoon/Signal/Dependency");
const DependentSymbol = Symbol("Typhoon/Signal/Dependent");

export abstract class DependencySignal<A = unknown, Err = unknown> {
  abstract readonly [DependencySymbol]: DependencySignal<A, Err>;

  abstract addDependent(
    dependent: DependentSignal,
  ): E.Effect<void, never, never>;
  abstract removeDependent(
    dependent: DependentSignal,
  ): E.Effect<void, never, never>;
  abstract clearDependents(): E.Effect<void, never, never>;

  abstract getDependents(): E.Effect<DependentSignal[], never, never>;

  abstract get value(): E.Effect<A, Err, SignalContext>;
  abstract peek(): E.Effect<A, Err, never>;

  static isDependencySignal(signal: unknown): signal is DependencySignal {
    return Boolean(
      signal &&
        typeof signal === "object" &&
        DependencySymbol in signal &&
        signal[DependencySymbol] === signal,
    );
  }

  static notifyAllDependents(
    signal: DependencySignal,
    beforeNotify: E.Effect<void, never, never>,
  ) {
    return pipe(
      E.Do,
      E.bind("dependents", () => getDependentsUpdateOrder(signal)),
      E.tap(signal.clearDependents()),
      E.tap(beforeNotify),
      E.flatMap(({ dependents }) =>
        E.all(dependents.map((dependent) => dependent.notify())),
      ),
      E.withSpan("DependencySignal.notifyAllDependents", {
        captureStackTrace: true,
      }),
      E.ignore,
    );
  }
}

export abstract class DependentSignal {
  abstract readonly [DependentSymbol]: DependentSignal;

  abstract addDependency(
    dependency: DependencySignal,
  ): E.Effect<void, never, never>;
  abstract removeDependency(
    dependency: DependencySignal,
  ): E.Effect<void, never, never>;
  abstract clearDependencies(): E.Effect<void, never, never>;

  abstract notify(): E.Effect<unknown, never, never>;

  static isDependentSignal(signal: unknown): signal is DependentSignal {
    return Boolean(
      signal &&
        typeof signal === "object" &&
        DependentSymbol in signal &&
        signal[DependentSymbol] === signal,
    );
  }
}

export const bindScopeDependency = (dependency: DependencySignal) =>
  pipe(
    SignalContext.getScope(),
    E.flatMap((scope) =>
      E.all([dependency.addDependent(scope), scope.addDependency(dependency)]),
    ),
    E.withSpan("bindScopeDependency", {
      captureStackTrace: true,
    }),
    E.ignore,
  );

const getDependentsUpdateOrder = (
  dependency: DependencySignal,
): E.Effect<DependentSignal[], never, never> => {
  return pipe(
    E.Do,
    E.bind("thisDependents", () => dependency.getDependents()),
    E.bind("nestedDependents", ({ thisDependents }) =>
      pipe(
        E.all(
          thisDependents
            .filter((dependent) =>
              DependencySignal.isDependencySignal(dependent),
            )
            .map((dependent) => getDependentsUpdateOrder(dependent)),
        ),
        E.map((nestedDependents) => nestedDependents.flat()),
      ),
    ),
    E.let("dependents", ({ thisDependents, nestedDependents }) => [
      ...thisDependents,
      ...nestedDependents,
    ]),
    E.map(({ dependents }) => {
      const seen = new Set();
      return dependents
        .reverse()
        .filter((item) => {
          if (seen.has(item)) return false;
          seen.add(item);
          return true;
        })
        .reverse();
    }),
    E.withSpan("getDependentsUpdateOrder", {
      captureStackTrace: true,
    }),
  );
};

const runAndTrackEffect = <A = unknown, Err = unknown>(
  effect: E.Effect<A, Err, SignalContext>,
  scope: DependentSignal,
) => {
  return pipe(
    effect,
    E.provideService(SignalContext, SignalContext.fromDependent(scope)),
    E.withSpan("runAndTrackEffect", {
      captureStackTrace: true,
    }),
  );
};

export class Signal<T = unknown> implements DependencySignal<T, never> {
  readonly [DependencySymbol]: DependencySignal<T, never> = this;

  private _value: T;
  private _dependents: HashSet.HashSet<DependentSignal>;

  constructor(value: T) {
    this._value = value;
    this._dependents = HashSet.empty();
  }

  addDependent(dependent: DependentSignal) {
    return E.sync(() => {
      this._dependents = HashSet.add(this._dependents, dependent);
    });
  }

  removeDependent(dependent: DependentSignal) {
    return E.sync(() => {
      this._dependents = HashSet.remove(this._dependents, dependent);
    });
  }

  clearDependents() {
    return E.sync(() => {
      HashSet.forEach(this._dependents, (dependent) =>
        dependent.removeDependency(this),
      );
      this._dependents = HashSet.empty();
    });
  }

  getDependents(): E.Effect<DependentSignal[], never, never> {
    return E.sync(() => HashSet.toValues(this._dependents));
  }

  get value(): E.Effect<T, never, SignalContext> {
    return pipe(
      bindScopeDependency(this),
      E.flatMap(() => this.peek()),
      E.withSpan("Signal.value", {
        captureStackTrace: true,
      }),
    );
  }

  peek(): E.Effect<T, never, never> {
    return pipe(
      E.suspend(() => E.succeed(this._value)),
      E.withSpan("Signal.peek", {
        captureStackTrace: true,
      }),
    );
  }

  setValue(value: T): E.Effect<void, never, never> {
    return pipe(
      DependencySignal.notifyAllDependents(
        this,
        E.suspend(() =>
          E.sync(() => {
            this._value = value;
          }),
        ),
      ),
      E.withSpan("Signal.setValue", {
        captureStackTrace: true,
      }),
    );
  }

  updateValue(
    updater: (value: T) => E.Effect<T>,
  ): E.Effect<void, never, never> {
    return pipe(
      DependencySignal.notifyAllDependents(
        this,
        E.suspend(() =>
          pipe(
            updater(this._value),
            E.tap((value) =>
              E.sync(() => {
                this._value = value;
              }),
            ),
          ),
        ),
      ),
      E.withSpan("Signal.updateValue", {
        captureStackTrace: true,
      }),
    );
  }
}

export const signal = <T>(value: T) => new Signal(value);

export class Computed<A = unknown, Err = unknown>
  implements DependentSignal, DependencySignal<A, Err>
{
  readonly [DependencySymbol]: DependencySignal<A, Err> = this;
  readonly [DependentSymbol]: DependentSignal = this;

  private _effect: E.Effect<A, Err, SignalContext>;
  private _value: Deferred.Deferred<A, Err>;
  private _fiber: Option.Option<Fiber.Fiber<boolean, never>>;
  private _dependents: HashSet.HashSet<DependentSignal>;
  private _dependencies: HashSet.HashSet<DependencySignal>;

  constructor(
    effect: E.Effect<A, Err, SignalContext>,
    value: Deferred.Deferred<A, Err>,
  ) {
    this._effect = effect;
    this._value = value;
    this._fiber = Option.none();
    this._dependents = HashSet.empty();
    this._dependencies = HashSet.empty();
  }

  addDependent(dependent: DependentSignal) {
    return E.sync(() => {
      this._dependents = HashSet.add(this._dependents, dependent);
    });
  }

  removeDependent(dependent: DependentSignal) {
    return E.sync(() => {
      this._dependents = HashSet.remove(this._dependents, dependent);
    });
  }

  clearDependents() {
    return E.sync(() => {
      HashSet.forEach(this._dependents, (dependent) =>
        dependent.removeDependency(this),
      );
      this._dependents = HashSet.empty();
    });
  }

  addDependency(dependency: DependencySignal) {
    return E.sync(() => {
      this._dependencies = HashSet.add(this._dependencies, dependency);
    });
  }

  removeDependency(dependency: DependencySignal) {
    return E.sync(() => {
      this._dependencies = HashSet.remove(this._dependencies, dependency);
    });
  }

  clearDependencies() {
    return E.sync(() => {
      HashSet.forEach(this._dependencies, (dependency) =>
        dependency.removeDependent(this),
      );
      this._dependencies = HashSet.empty();
    });
  }

  getDependents(): E.Effect<DependentSignal[], never, never> {
    return E.sync(() => HashSet.toValues(this._dependents));
  }

  get value(): E.Effect<A, Err, SignalContext> {
    return pipe(
      bindScopeDependency(this),
      E.flatMap(() => this.peek()),
      E.withSpan("Computed.value", {
        captureStackTrace: true,
      }),
    );
  }

  peek(): E.Effect<A, Err, never> {
    return pipe(
      E.Do,
      E.bind("fiber", () =>
        pipe(
          this._fiber,
          Option.match({
            onSome: (fiber) => E.succeed(fiber),
            onNone: () =>
              pipe(
                this._value,
                Deferred.complete(runAndTrackEffect(this._effect, this)),
                E.forkDaemon,
              ),
          }),
        ),
      ),
      E.tap(({ fiber }) => {
        this._fiber = Option.some(fiber);
      }),
      E.flatMap(() => Deferred.await(this._value)),
      E.withSpan("Computed.peek", {
        captureStackTrace: true,
      }),
    );
  }

  reset(): E.Effect<void, never, never> {
    return pipe(
      E.all([
        pipe(
          Deferred.make<A, Err>(),
          E.map((value) => {
            this._value = value;
          }),
        ),
        pipe(
          E.succeed(this._fiber),
          E.tap(() => {
            this._fiber = Option.none();
          }),
          E.flatMap((fiber) =>
            pipe(
              fiber,
              Option.match({
                onSome: (fiber) => Fiber.interrupt(fiber),
                onNone: () => E.void,
              }),
            ),
          ),
        ),
      ]),
      E.withSpan("Computed.reset", {
        captureStackTrace: true,
      }),
    );
  }

  notify(): E.Effect<unknown, never, never> {
    return pipe(
      this.clearDependencies(),
      E.andThen(this.reset()),
      E.withSpan("Computed.notify", {
        captureStackTrace: true,
      }),
    );
  }

  recompute(): E.Effect<void, never, never> {
    return pipe(
      DependencySignal.notifyAllDependents(this, this.reset()),
      E.withSpan("Computed.recompute", {
        captureStackTrace: true,
      }),
    );
  }
}

export const computed = <A = unknown, Err = unknown>(
  effect: E.Effect<A, Err, SignalContext>,
) =>
  pipe(
    Deferred.make<A, Err>(),
    E.map((value) => new Computed(effect, value)),
    E.withSpan("computed", {
      captureStackTrace: true,
    }),
  );

class Effect implements DependentSignal {
  readonly [DependentSymbol]: DependentSignal = this;

  private _effect: E.Effect<unknown, unknown, SignalContext>;
  private _fiber: Option.Option<Fiber.Fiber<unknown, unknown>>;
  private _dependencies: HashSet.HashSet<DependencySignal>;

  constructor(effect: E.Effect<unknown, unknown, SignalContext>) {
    this._effect = effect;
    this._fiber = Option.none();
    this._dependencies = HashSet.empty();
  }

  addDependency(dependency: DependencySignal) {
    return E.sync(() => {
      this._dependencies = HashSet.add(this._dependencies, dependency);
    });
  }

  removeDependency(dependency: DependencySignal) {
    return E.sync(() => {
      this._dependencies = HashSet.remove(this._dependencies, dependency);
    });
  }

  clearDependencies() {
    return E.sync(() => {
      HashSet.forEach(this._dependencies, (dependency) =>
        dependency.removeDependent(this),
      );
      this._dependencies = HashSet.empty();
    });
  }

  notify(): E.Effect<unknown, never, never> {
    return pipe(
      E.all([
        this.clearDependencies(),
        pipe(
          E.Do,
          E.let("fiber", () => this._fiber),
          E.bind("newFiber", () =>
            pipe(runAndTrackEffect(this._effect, this), E.forkDaemon),
          ),
          E.tap(({ newFiber }) => {
            this._fiber = Option.some(newFiber);
          }),
          E.flatMap(({ fiber }) =>
            pipe(
              fiber,
              Option.match({
                onSome: (fiber) => Fiber.interrupt(fiber),
                onNone: () => E.void,
              }),
            ),
          ),
        ),
      ]),
      E.withSpan("Effect.notify", {
        captureStackTrace: true,
      }),
    );
  }

  cleanup() {
    return pipe(
      E.sync(() => {
        this._effect = E.void;
      }),
      E.andThen(this.clearDependencies()),
      E.withSpan("Effect.cleanup", {
        captureStackTrace: true,
      }),
    );
  }
}

export const effect = (effect: E.Effect<unknown, unknown, SignalContext>) =>
  pipe(
    E.succeed(new Effect(effect)),
    E.tap((effect) => effect.notify()),
    E.map((effect) => effect.cleanup()),
    E.withSpan("effect", {
      captureStackTrace: true,
    }),
  );

class OnceObserver<A = unknown, Err = unknown> implements DependentSignal {
  readonly [DependentSymbol]: DependentSignal = this;

  private _dependencies: HashSet.HashSet<DependencySignal>;
  private _fiber: Deferred.Deferred<Fiber.Fiber<A, Err>, never>;

  constructor(fiber: Deferred.Deferred<Fiber.Fiber<A, Err>, never>) {
    this._dependencies = HashSet.empty();
    this._fiber = fiber;
  }

  static make<A = unknown, Err = unknown>(
    effect: E.Effect<A, Err, SignalContext>,
  ) {
    return pipe(
      E.Do,
      E.bind("deferred", () => Deferred.make<Fiber.Fiber<A, Err>, never>()),
      E.let("observer", ({ deferred }) => new OnceObserver(deferred)),
      E.tap(({ deferred, observer }) =>
        Deferred.complete(
          deferred,
          E.forkDaemon(runAndTrackEffect(effect, observer)),
        ),
      ),
      E.map(({ observer }) => observer),
    );
  }

  addDependency(dependency: DependencySignal) {
    return E.sync(() => {
      this._dependencies = HashSet.add(this._dependencies, dependency);
    });
  }

  removeDependency(dependency: DependencySignal) {
    return E.sync(() => {
      this._dependencies = HashSet.remove(this._dependencies, dependency);
    });
  }

  clearDependencies() {
    return E.sync(() => {
      HashSet.forEach(this._dependencies, (dependency) =>
        dependency.removeDependent(this),
      );
      this._dependencies = HashSet.empty();
    });
  }

  get value(): E.Effect<A, Err, never> {
    return pipe(
      E.Do,
      E.bind("fiber", () => Deferred.await(this._fiber)),
      E.flatMap(({ fiber }) => Fiber.join(fiber)),
      E.withSpan("OnceObserver.value", {
        captureStackTrace: true,
      }),
    );
  }

  notify(): E.Effect<unknown, never, never> {
    return pipe(
      this.clearDependencies(),
      E.withSpan("OnceObserver.notify", {
        captureStackTrace: true,
      }),
    );
  }
}

export const observeOnce = <A = unknown, Err = unknown>(
  effect: E.Effect<A, Err, SignalContext>,
) => OnceObserver.make(effect);

export class SignalContext extends Context.Tag("SignalContext")<
  SignalContext,
  {
    readonly scope: DependentSignal;
  }
>() {
  static fromDependent(
    dependent: DependentSignal,
  ): Context.Tag.Service<SignalContext> {
    return {
      scope: dependent,
    };
  }

  static getScope() {
    return pipe(
      SignalContext,
      E.map(({ scope }) => scope),
      E.withSpan("SignalContext.getScope", {
        captureStackTrace: true,
      }),
    );
  }
}
