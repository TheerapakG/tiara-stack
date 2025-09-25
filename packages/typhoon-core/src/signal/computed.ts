import {
  Deferred,
  Effect,
  Effectable,
  Fiber,
  Function,
  HashSet,
  Option,
  pipe,
} from "effect";
import { Observable } from "../observability";
import {
  DependencySignal,
  DependencySymbol,
  notifyAllDependents,
} from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import {
  bindScopeDependency,
  fromDependent,
  runAndTrackEffect,
  SignalContext,
} from "./signalContext";

export class Computed<A = never, E = never, R = never>
  extends Effectable.Class<A, E, R | SignalContext>
  implements DependentSignal, DependencySignal<A, E, R>
{
  readonly [DependencySymbol]: DependencySignal<A, E, R> = this;
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: Effect.Effect<A, E, R | SignalContext>;
  private _value: Deferred.Deferred<A, E>;
  private _fiber: Option.Option<Fiber.Fiber<boolean, never>>;
  private _dependents: HashSet.HashSet<DependentSignal>;
  private _dependencies: HashSet.HashSet<DependencySignal>;

  constructor(
    effect: Effect.Effect<A, E, R | SignalContext>,
    value: Deferred.Deferred<A, E>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._effect = effect;
    this._value = value;
    this._fiber = Option.none();
    this._dependents = HashSet.empty();
    this._dependencies = HashSet.empty();
    this[Observable.ObservableSymbol] = options;
  }

  addDependent(dependent: DependentSignal) {
    return Effect.sync(() => {
      this._dependents = HashSet.add(this._dependents, dependent);
    });
  }

  removeDependent(dependent: DependentSignal) {
    return Effect.sync(() => {
      this._dependents = HashSet.remove(this._dependents, dependent);
    });
  }

  clearDependents() {
    return Effect.sync(() => {
      HashSet.forEach(this._dependents, (dependent) =>
        dependent.removeDependency(this),
      );
      this._dependents = HashSet.empty();
    });
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

  getDependents(): Effect.Effect<DependentSignal[], never, never> {
    return Effect.sync(() => HashSet.toValues(this._dependents));
  }

  get value(): Effect.Effect<A, E, R | SignalContext> {
    return pipe(
      bindScopeDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "Computed.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<A, E, R | SignalContext> {
    return this.value;
  }

  peek(): Effect.Effect<A, E, R> {
    return pipe(
      Effect.Do,
      Effect.bind("fiber", () =>
        pipe(
          this._fiber,
          Option.match({
            onSome: (fiber) => Effect.succeed(fiber),
            onNone: () =>
              pipe(
                fromDependent(this),
                runAndTrackEffect(this._effect),
                Effect.exit,
                Effect.flatMap((value) =>
                  Deferred.complete(this._value, value),
                ),
                Effect.forkDaemon,
              ),
          }),
        ),
      ),
      Effect.tap(({ fiber }) => {
        this._fiber = Option.some(fiber);
      }),
      Effect.flatMap(() => Deferred.await(this._value)),
      Observable.withSpan(this, "Computed.peek", {
        captureStackTrace: true,
      }),
    );
  }

  reset(): Effect.Effect<void, never, never> {
    return pipe(
      Effect.all([
        pipe(
          Deferred.make<A, E>(),
          Effect.map((value) => {
            this._value = value;
          }),
        ),
        pipe(
          Effect.succeed(this._fiber),
          Effect.tap(() => {
            this._fiber = Option.none();
          }),
          Effect.flatMap((fiber) =>
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
      Observable.withSpan(this, "Computed.reset", {
        captureStackTrace: true,
      }),
    );
  }

  notify(): Effect.Effect<unknown, never, never> {
    return pipe(
      this.clearDependencies(),
      Effect.andThen(this.reset()),
      Observable.withSpan(this, "Computed.notify", {
        captureStackTrace: true,
      }),
    );
  }

  recompute(): Effect.Effect<void, never, never> {
    return pipe(
      this,
      notifyAllDependents(this.reset()),
      Observable.withSpan(this, "Computed.recompute", {
        captureStackTrace: true,
      }),
    );
  }
}

export const make = <A = never, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    Deferred.make<A, E>(),
    Effect.map(
      (value) =>
        new Computed<A, E, Exclude<R, SignalContext>>(
          effect as Effect.Effect<
            A,
            E,
            SignalContext | Exclude<R, SignalContext>
          >,
          value,
          options ?? {},
        ),
    ),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "Computed.make",
      {
        captureStackTrace: true,
      },
    ),
  );

export const map =
  <A, B>(mapper: (value: A) => B, options?: Observable.ObservableOptions) =>
  <E1, R1, E2, R2>(
    signal: Effect.Effect<DependencySignal<A, E1, R1>, E2, R2>,
  ) =>
    make(
      pipe(signal, Effect.flatMap(Function.identity), Effect.map(mapper)),
      options,
    );

export const flatMap =
  <A, B, E3, R3>(
    mapper: (value: A) => Effect.Effect<B, E3, R3>,
    options?: Observable.ObservableOptions,
  ) =>
  <E1, R1, E2, R2>(
    signal: Effect.Effect<DependencySignal<A, E1, R1>, E2, R2>,
  ) =>
    make(
      pipe(signal, Effect.flatMap(Function.identity), Effect.flatMap(mapper)),
      options,
    );

export const flatMapComputed =
  <A, B, E3, R3, E4, R4>(
    mapper: (value: A) => Effect.Effect<DependencySignal<B, E3, R3>, E4, R4>,
    options?: Observable.ObservableOptions,
  ) =>
  <E1, R1, E2, R2>(
    signal: Effect.Effect<DependencySignal<A, E1, R1>, E2, R2>,
  ) =>
    make(
      pipe(
        signal,
        Effect.flatMap(Function.identity),
        Effect.flatMap(mapper),
        Effect.flatMap(Function.identity),
      ),
      options,
    );

export const annotateLogs =
  <E1 = never, R1 = never>(
    key: string,
    value: DependencySignal<unknown, E1, R1>,
  ) =>
  <A = never, E2 = never, R2 = never, E3 = never, R3 = never>(
    signal: Effect.Effect<DependencySignal<A, E2, R2>, E3, R3>,
  ) =>
    make(
      pipe(
        value,
        Effect.flatMap((value) =>
          pipe(
            signal,
            Effect.flatMap(Function.identity),
            Effect.annotateLogs(key, value),
          ),
        ),
      ),
    );

export const annotateSpans =
  <E1 = never, R1 = never>(
    key: string,
    value: DependencySignal<unknown, E1, R1>,
  ) =>
  <A = never, E2 = never, R2 = never, E3 = never, R3 = never>(
    signal: Effect.Effect<DependencySignal<A, E2, R2>, E3, R3>,
  ) =>
    make(
      pipe(
        value,
        Effect.flatMap((value) =>
          pipe(
            signal,
            Effect.flatMap(Function.identity),
            Effect.annotateSpans(key, value),
          ),
        ),
      ),
    );
