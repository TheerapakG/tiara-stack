import { Effect, Fiber, HashSet, Option, pipe } from "effect";
import { Observable } from "../observability";
import { DependencySignal } from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import {
  fromDependent,
  runAndTrackEffect,
  SignalContext,
} from "./signalContext";

export class SideEffect implements DependentSignal {
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: Effect.Effect<unknown, unknown, SignalContext>;
  private _fiber: Option.Option<Fiber.Fiber<unknown, unknown>>;
  private _dependencies: HashSet.HashSet<DependencySignal>;

  constructor(
    effect: Effect.Effect<unknown, unknown, SignalContext>,
    options: Observable.ObservableOptions,
  ) {
    this._effect = effect;
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
) =>
  pipe(
    Effect.succeed(new SideEffect(effect, options ?? {})),
    Effect.tap((sideEffect) => sideEffect.notify()),
    Effect.map((sideEffect) => sideEffect.cleanup()),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "SideEffect.make",
      {
        captureStackTrace: true,
      },
    ),
  );
