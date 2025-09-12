import {
  Context,
  Deferred,
  Effect as Effect_,
  Effectable,
  Fiber,
  Function,
  HashSet,
  Option,
  pipe,
} from "effect";
import {
  Observable,
  ObservableOptions,
  ObservableSymbol,
} from "../obsevability/observable";

const DependencySymbol = Symbol("Typhoon/Signal/Dependency");
const DependentSymbol = Symbol("Typhoon/Signal/Dependent");

export abstract class DependencySignal<A = never, E = never, R = never>
  extends Effectable.Class<A, E, R | SignalContext>
  implements Observable
{
  abstract readonly [DependencySymbol]: DependencySignal<A, E, R>;
  abstract readonly [ObservableSymbol]: ObservableOptions;

  abstract addDependent(
    dependent: DependentSignal,
  ): Effect_.Effect<void, never, never>;
  abstract removeDependent(
    dependent: DependentSignal,
  ): Effect_.Effect<void, never, never>;
  abstract clearDependents(): Effect_.Effect<void, never, never>;

  abstract getDependents(): Effect_.Effect<DependentSignal[], never, never>;

  abstract get value(): Effect_.Effect<A, E, R | SignalContext>;
  abstract peek(): Effect_.Effect<A, E, R>;

  static isDependencySignal(signal: unknown): signal is DependencySignal {
    return Boolean(
      signal &&
        typeof signal === "object" &&
        DependencySymbol in signal &&
        signal[DependencySymbol] === signal,
    );
  }

  static notifyAllDependents(
    signal: DependencySignal<unknown, unknown, unknown>,
    beforeNotify: Effect_.Effect<void, never, never>,
  ) {
    return pipe(
      Effect_.Do,
      Effect_.bind("dependents", () => getDependentsUpdateOrder(signal)),
      Effect_.tap(signal.clearDependents()),
      Effect_.tap(beforeNotify),
      Effect_.flatMap(({ dependents }) =>
        Effect_.all(dependents.map((dependent) => dependent.notify())),
      ),
      Observable.withSpan(signal, "DependencySignal.notifyAllDependents", {
        captureStackTrace: true,
      }),
      Effect_.ignore,
    );
  }
}

export abstract class DependentSignal implements Observable {
  abstract readonly [DependentSymbol]: DependentSignal;
  abstract readonly [ObservableSymbol]: ObservableOptions;

  abstract addDependency(
    dependency: DependencySignal<unknown, unknown, unknown>,
  ): Effect_.Effect<void, never, never>;
  abstract removeDependency(
    dependency: DependencySignal<unknown, unknown, unknown>,
  ): Effect_.Effect<void, never, never>;
  abstract clearDependencies(): Effect_.Effect<void, never, never>;

  abstract notify(): Effect_.Effect<unknown, never, never>;

  static isDependentSignal(signal: unknown): signal is DependentSignal {
    return Boolean(
      signal &&
        typeof signal === "object" &&
        DependentSymbol in signal &&
        signal[DependentSymbol] === signal,
    );
  }
}

export const bindScopeDependency = (
  dependency: DependencySignal<unknown, unknown, unknown>,
) =>
  pipe(
    SignalContext.getScope(dependency),
    Effect_.flatMap((scope) =>
      Effect_.all([
        dependency.addDependent(scope),
        scope.addDependency(dependency),
      ]),
    ),
    Observable.withSpan(dependency, "bindScopeDependency", {
      captureStackTrace: true,
    }),
    Effect_.ignore,
  );

const getDependentsUpdateOrder = (
  dependency: DependencySignal<unknown, unknown, unknown>,
): Effect_.Effect<DependentSignal[], never, never> => {
  return pipe(
    Effect_.Do,
    Effect_.bind("thisDependents", () => dependency.getDependents()),
    Effect_.bind("nestedDependents", ({ thisDependents }) =>
      pipe(
        Effect_.all(
          thisDependents
            .filter((dependent) =>
              DependencySignal.isDependencySignal(dependent),
            )
            .map((dependent) => getDependentsUpdateOrder(dependent)),
        ),
        Effect_.map((nestedDependents) => nestedDependents.flat()),
      ),
    ),
    Effect_.let("dependents", ({ thisDependents, nestedDependents }) => [
      ...thisDependents,
      ...nestedDependents,
    ]),
    Effect_.map(({ dependents }) => {
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
    Observable.withSpan(dependency, "getDependentsUpdateOrder", {
      captureStackTrace: true,
    }),
  );
};

const runAndTrackEffect = <A = never, E = never, R = never>(
  effect: Effect_.Effect<A, E, R | SignalContext>,
  scope: DependentSignal,
) => {
  return pipe(
    effect,
    Effect_.provideService(SignalContext, SignalContext.fromDependent(scope)),
    Observable.withSpan(scope, "runAndTrackEffect", {
      captureStackTrace: true,
    }),
  );
};

export class Signal<T = unknown>
  extends Effectable.Class<T, never, SignalContext>
  implements DependencySignal<T, never, never>
{
  readonly [DependencySymbol]: DependencySignal<T, never, never> = this;
  readonly [ObservableSymbol]: ObservableOptions;

  private _value: T;
  private _dependents: HashSet.HashSet<DependentSignal>;

  constructor(value: T, options: ObservableOptions) {
    super();
    this._value = value;
    this._dependents = HashSet.empty();
    this[ObservableSymbol] = options;
  }

  addDependent(dependent: DependentSignal) {
    return Effect_.sync(() => {
      this._dependents = HashSet.add(this._dependents, dependent);
    });
  }

  removeDependent(dependent: DependentSignal) {
    return Effect_.sync(() => {
      this._dependents = HashSet.remove(this._dependents, dependent);
    });
  }

  clearDependents() {
    return Effect_.sync(() => {
      HashSet.forEach(this._dependents, (dependent) =>
        dependent.removeDependency(this),
      );
      this._dependents = HashSet.empty();
    });
  }

  getDependents(): Effect_.Effect<DependentSignal[], never, never> {
    return Effect_.sync(() => HashSet.toValues(this._dependents));
  }

  get value(): Effect_.Effect<T, never, SignalContext> {
    return pipe(
      bindScopeDependency(this),
      Effect_.flatMap(() => this.peek()),
      Observable.withSpan(this, "Signal.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect_.Effect<T, never, SignalContext> {
    return this.value;
  }

  peek(): Effect_.Effect<T, never, never> {
    return pipe(
      Effect_.suspend(() => Effect_.succeed(this._value)),
      Observable.withSpan(this, "Signal.peek", {
        captureStackTrace: true,
      }),
    );
  }

  setValue(value: T): Effect_.Effect<void, never, never> {
    return pipe(
      DependencySignal.notifyAllDependents(
        this,
        Effect_.suspend(() =>
          Effect_.sync(() => {
            this._value = value;
          }),
        ),
      ),
      Observable.withSpan(this, "Signal.setValue", {
        captureStackTrace: true,
      }),
    );
  }

  updateValue(
    updater: (value: T) => Effect_.Effect<T>,
  ): Effect_.Effect<void, never, never> {
    return pipe(
      DependencySignal.notifyAllDependents(
        this,
        Effect_.suspend(() =>
          pipe(
            updater(this._value),
            Effect_.tap((value) =>
              Effect_.sync(() => {
                this._value = value;
              }),
            ),
          ),
        ),
      ),
      Observable.withSpan(this, "Signal.updateValue", {
        captureStackTrace: true,
      }),
    );
  }
}

export const signal = <T>(value: T, options?: ObservableOptions) =>
  new Signal(value, options ?? {});

export class Computed<A = never, E = never, R = never>
  extends Effectable.Class<A, E, R | SignalContext>
  implements DependentSignal, DependencySignal<A, E, R>
{
  readonly [DependencySymbol]: DependencySignal<A, E, R> = this;
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [ObservableSymbol]: ObservableOptions;

  private _effect: Effect_.Effect<A, E, R | SignalContext>;
  private _value: Deferred.Deferred<A, E>;
  private _fiber: Option.Option<Fiber.Fiber<boolean, never>>;
  private _dependents: HashSet.HashSet<DependentSignal>;
  private _dependencies: HashSet.HashSet<DependencySignal>;

  constructor(
    effect: Effect_.Effect<A, E, R | SignalContext>,
    value: Deferred.Deferred<A, E>,
    options: ObservableOptions,
  ) {
    super();
    this._effect = effect;
    this._value = value;
    this._fiber = Option.none();
    this._dependents = HashSet.empty();
    this._dependencies = HashSet.empty();
    this[ObservableSymbol] = options;
  }

  addDependent(dependent: DependentSignal) {
    return Effect_.sync(() => {
      this._dependents = HashSet.add(this._dependents, dependent);
    });
  }

  removeDependent(dependent: DependentSignal) {
    return Effect_.sync(() => {
      this._dependents = HashSet.remove(this._dependents, dependent);
    });
  }

  clearDependents() {
    return Effect_.sync(() => {
      HashSet.forEach(this._dependents, (dependent) =>
        dependent.removeDependency(this),
      );
      this._dependents = HashSet.empty();
    });
  }

  addDependency(dependency: DependencySignal) {
    return Effect_.sync(() => {
      this._dependencies = HashSet.add(this._dependencies, dependency);
    });
  }

  removeDependency(dependency: DependencySignal) {
    return Effect_.sync(() => {
      this._dependencies = HashSet.remove(this._dependencies, dependency);
    });
  }

  clearDependencies() {
    return Effect_.sync(() => {
      HashSet.forEach(this._dependencies, (dependency) =>
        dependency.removeDependent(this),
      );
      this._dependencies = HashSet.empty();
    });
  }

  getDependents(): Effect_.Effect<DependentSignal[], never, never> {
    return Effect_.sync(() => HashSet.toValues(this._dependents));
  }

  get value(): Effect_.Effect<A, E, R | SignalContext> {
    return pipe(
      bindScopeDependency(this),
      Effect_.flatMap(() => this.peek()),
      Observable.withSpan(this, "Computed.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect_.Effect<A, E, R | SignalContext> {
    return this.value;
  }

  peek(): Effect_.Effect<A, E, R> {
    return pipe(
      Effect_.Do,
      Effect_.bind("fiber", () =>
        pipe(
          this._fiber,
          Option.match({
            onSome: (fiber) => Effect_.succeed(fiber),
            onNone: () =>
              pipe(
                runAndTrackEffect(this._effect, this),
                Effect_.exit,
                Effect_.flatMap((value) =>
                  Deferred.complete(this._value, value),
                ),
                Effect_.forkDaemon,
              ),
          }),
        ),
      ),
      Effect_.tap(({ fiber }) => {
        this._fiber = Option.some(fiber);
      }),
      Effect_.flatMap(() => Deferred.await(this._value)),
      Observable.withSpan(this, "Computed.peek", {
        captureStackTrace: true,
      }),
    );
  }

  reset(): Effect_.Effect<void, never, never> {
    return pipe(
      Effect_.all([
        pipe(
          Deferred.make<A, E>(),
          Effect_.map((value) => {
            this._value = value;
          }),
        ),
        pipe(
          Effect_.succeed(this._fiber),
          Effect_.tap(() => {
            this._fiber = Option.none();
          }),
          Effect_.flatMap((fiber) =>
            pipe(
              fiber,
              Option.match({
                onSome: (fiber) => Fiber.interrupt(fiber),
                onNone: () => Effect_.void,
              }),
            ),
          ),
        ),
      ]),
      Observable.withSpan(this, "Computed.reset", {
        captureStackTrace: true,
      }),
    );
  }

  notify(): Effect_.Effect<unknown, never, never> {
    return pipe(
      this.clearDependencies(),
      Effect_.andThen(this.reset()),
      Observable.withSpan(this, "Computed.notify", {
        captureStackTrace: true,
      }),
    );
  }

  recompute(): Effect_.Effect<void, never, never> {
    return pipe(
      DependencySignal.notifyAllDependents(this, this.reset()),
      Observable.withSpan(this, "Computed.recompute", {
        captureStackTrace: true,
      }),
    );
  }

  static map<A, B>(mapper: (value: A) => B, options?: ObservableOptions) {
    return <E1, R1, E2, R2>(
      signal: Effect_.Effect<DependencySignal<A, E1, R1>, E2, R2>,
    ) =>
      computed(
        pipe(signal, Effect_.flatMap(Function.identity), Effect_.map(mapper)),
        options,
      );
  }

  static flatMap<A, B, E3, R3>(
    mapper: (value: A) => Effect_.Effect<B, E3, R3>,
    options?: ObservableOptions,
  ) {
    return <E1, R1, E2, R2>(
      signal: Effect_.Effect<DependencySignal<A, E1, R1>, E2, R2>,
    ) =>
      computed(
        pipe(
          signal,
          Effect_.flatMap(Function.identity),
          Effect_.flatMap(mapper),
        ),
        options,
      );
  }

  static flatMapComputed<A, B, E3, R3, E4, R4>(
    mapper: (value: A) => Effect_.Effect<DependencySignal<B, E3, R3>, E4, R4>,
    options?: ObservableOptions,
  ) {
    return <E1, R1, E2, R2>(
      signal: Effect_.Effect<DependencySignal<A, E1, R1>, E2, R2>,
    ) =>
      computed(
        pipe(
          signal,
          Effect_.flatMap(Function.identity),
          Effect_.flatMap(mapper),
          Effect_.flatMap(Function.identity),
        ),
        options,
      );
  }

  static annotateLogs<E1 = never, R1 = never>(
    key: string,
    value: DependencySignal<unknown, E1, R1>,
  ) {
    return <A = never, E2 = never, R2 = never, E3 = never, R3 = never>(
      signal: Effect_.Effect<DependencySignal<A, E2, R2>, E3, R3>,
    ) =>
      computed(
        pipe(
          value,
          Effect_.flatMap((value) =>
            pipe(
              signal,
              Effect_.flatMap(Function.identity),
              Effect_.annotateLogs(key, value),
            ),
          ),
        ),
      );
  }

  static annotateSpans<E1 = never, R1 = never>(
    key: string,
    value: DependencySignal<unknown, E1, R1>,
  ) {
    return <A = never, E2 = never, R2 = never, E3 = never, R3 = never>(
      signal: Effect_.Effect<DependencySignal<A, E2, R2>, E3, R3>,
    ) =>
      computed(
        pipe(
          value,
          Effect_.flatMap((value) =>
            pipe(
              signal,
              Effect_.flatMap(Function.identity),
              Effect_.annotateSpans(key, value),
            ),
          ),
        ),
      );
  }
}

export const computed = <A = never, E = never, R = never>(
  effect: Effect_.Effect<A, E, R | SignalContext>,
  options?: ObservableOptions,
) =>
  pipe(
    Deferred.make<A, E>(),
    Effect_.map((value) => new Computed<A, E, R>(effect, value, options ?? {})),
    Observable.withSpan({ [ObservableSymbol]: options ?? {} }, "computed", {
      captureStackTrace: true,
    }),
  );

class Effect implements DependentSignal {
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [ObservableSymbol]: ObservableOptions;

  private _effect: Effect_.Effect<unknown, unknown, SignalContext>;
  private _fiber: Option.Option<Fiber.Fiber<unknown, unknown>>;
  private _dependencies: HashSet.HashSet<DependencySignal>;

  constructor(
    effect: Effect_.Effect<unknown, unknown, SignalContext>,
    options: ObservableOptions,
  ) {
    this._effect = effect;
    this._fiber = Option.none();
    this._dependencies = HashSet.empty();
    this[ObservableSymbol] = options;
  }

  addDependency(dependency: DependencySignal) {
    return Effect_.sync(() => {
      this._dependencies = HashSet.add(this._dependencies, dependency);
    });
  }

  removeDependency(dependency: DependencySignal) {
    return Effect_.sync(() => {
      this._dependencies = HashSet.remove(this._dependencies, dependency);
    });
  }

  clearDependencies() {
    return Effect_.sync(() => {
      HashSet.forEach(this._dependencies, (dependency) =>
        dependency.removeDependent(this),
      );
      this._dependencies = HashSet.empty();
    });
  }

  notify(): Effect_.Effect<unknown, never, never> {
    return pipe(
      Effect_.all([
        this.clearDependencies(),
        pipe(
          Effect_.Do,
          Effect_.let("fiber", () => this._fiber),
          Effect_.bind("newFiber", () =>
            pipe(runAndTrackEffect(this._effect, this), Effect_.forkDaemon),
          ),
          Effect_.tap(({ newFiber }) => {
            this._fiber = Option.some(newFiber);
          }),
          Effect_.flatMap(({ fiber }) =>
            pipe(
              fiber,
              Option.match({
                onSome: (fiber) => Fiber.interrupt(fiber),
                onNone: () => Effect_.void,
              }),
            ),
          ),
        ),
      ]),
      Observable.withSpan(this, "Effect.notify", {
        captureStackTrace: true,
      }),
    );
  }

  cleanup() {
    return pipe(
      Effect_.sync(() => {
        this._effect = Effect_.void;
      }),
      Effect_.andThen(this.clearDependencies()),
      Observable.withSpan(this, "Effect.cleanup", {
        captureStackTrace: true,
      }),
    );
  }
}

export const effect = (
  effect: Effect_.Effect<unknown, unknown, SignalContext>,
  options?: ObservableOptions,
) =>
  pipe(
    Effect_.succeed(new Effect(effect, options ?? {})),
    Effect_.tap((effect) => effect.notify()),
    Effect_.map((effect) => effect.cleanup()),
    Observable.withSpan({ [ObservableSymbol]: options ?? {} }, "effect", {
      captureStackTrace: true,
    }),
  );

class OnceObserver<A = never, E = never>
  extends Effectable.Class<A, E, never>
  implements DependentSignal
{
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [ObservableSymbol]: ObservableOptions;

  private _dependencies: HashSet.HashSet<DependencySignal>;
  private _fiber: Deferred.Deferred<Fiber.Fiber<A, E>, never>;

  constructor(
    fiber: Deferred.Deferred<Fiber.Fiber<A, E>, never>,
    options: ObservableOptions,
  ) {
    super();
    this._dependencies = HashSet.empty();
    this._fiber = fiber;
    this[ObservableSymbol] = options;
  }

  static make<A = never, E = never, R = never>(
    effect: Effect_.Effect<A, E, R | SignalContext>,
    options: ObservableOptions,
  ) {
    return pipe(
      Effect_.Do,
      Effect_.bind("deferred", () => Deferred.make<Fiber.Fiber<A, E>, never>()),
      Effect_.let(
        "observer",
        ({ deferred }) => new OnceObserver(deferred, options),
      ),
      Effect_.tap(({ deferred, observer }) =>
        pipe(
          runAndTrackEffect(effect, observer),
          Effect_.forkDaemon,
          Effect_.flatMap((fiber) => Deferred.succeed(deferred, fiber)),
        ),
      ),
      Effect_.map(({ observer }) => observer),
    );
  }

  addDependency(dependency: DependencySignal) {
    return Effect_.sync(() => {
      this._dependencies = HashSet.add(this._dependencies, dependency);
    });
  }

  removeDependency(dependency: DependencySignal) {
    return Effect_.sync(() => {
      this._dependencies = HashSet.remove(this._dependencies, dependency);
    });
  }

  clearDependencies() {
    return Effect_.sync(() => {
      HashSet.forEach(this._dependencies, (dependency) =>
        dependency.removeDependent(this),
      );
      this._dependencies = HashSet.empty();
    });
  }

  commit(): Effect_.Effect<A, E, never> {
    return this.value;
  }

  get value(): Effect_.Effect<A, E, never> {
    return pipe(
      Effect_.Do,
      Effect_.bind("fiber", () => Deferred.await(this._fiber)),
      Effect_.flatMap(({ fiber }) => Fiber.join(fiber)),
      Observable.withSpan(this, "OnceObserver.value", {
        captureStackTrace: true,
      }),
    );
  }

  notify(): Effect_.Effect<unknown, never, never> {
    return pipe(
      this.clearDependencies(),
      Observable.withSpan(this, "OnceObserver.notify", {
        captureStackTrace: true,
      }),
    );
  }
}

export const observeOnce = <A = never, E = never, R = never>(
  effect: Effect_.Effect<A, E, R | SignalContext>,
  options?: ObservableOptions,
) =>
  pipe(
    OnceObserver.make(effect, options ?? {}),
    Effect_.flatMap((observer) => observer),
    Observable.withSpan({ [ObservableSymbol]: options ?? {} }, "observeOnce", {
      captureStackTrace: true,
    }),
  );

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

  static getScope(dependency: DependencySignal<unknown, unknown, unknown>) {
    return pipe(
      SignalContext,
      Effect_.map(({ scope }) => scope),
      Observable.withSpan(dependency, "SignalContext.getScope", {
        captureStackTrace: true,
      }),
    );
  }
}
