import { Context, Effect, Fiber, HashSet, Option, pipe } from "effect";
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
      // Scan upstream and start external sources if present.
      Effect.tap(() => startExternalSourcesIfAny(this)),
      Observable.withSpan(this, "SideEffect.notify", {
        captureStackTrace: true,
      }),
      Effect.ignore,
    ) as unknown as Effect.Effect<unknown, never, never>;
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

// Walk dependencies recursively to locate ExternalComputed instances and request emitting start.
const startExternalSourcesIfAny = (root: SideEffect<any>) =>
  pipe(
    collectDependenciesRecursive(root),
    Effect.flatMap((deps) =>
      Effect.all(
        deps.map((dep) =>
          importExternalComputed().pipe(
            Effect.flatMap(({ ExternalComputed }) =>
              dep instanceof ExternalComputed.ExternalComputed
                ? (dep as any).requestStart()
                : Effect.void,
            ),
          ),
        ),
      ),
    ),
  );

const collectDependenciesRecursive = (
  node: DependentSignal,
): Effect.Effect<any[], never, never> =>
  pipe(
    node.getDependencies(),
    Effect.flatMap((deps) =>
      Effect.all(
        deps.map((dep) =>
          // If a dependency is also a DependentSignal (e.g., Computed), recurse upstream
          DependentSymbol in (dep as any) &&
          (dep as any)[DependentSymbol] === dep
            ? collectDependenciesRecursive(dep as unknown as DependentSignal)
            : Effect.succeed<any[]>([]),
        ),
      ).pipe(Effect.map((nesteds) => [deps, ...nesteds].flat())),
    ),
  );

const importExternalComputed = () =>
  Effect.sync(() => require("./externalComputed"));

export const make = (
  effect: Effect.Effect<unknown, unknown, SignalContext>,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    Effect.succeed(
      new SideEffect<never>(effect, Context.empty(), options ?? {}),
    ),
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

export const makeWithContext = <R = never>(
  effect: Effect.Effect<unknown, unknown, R>,
  context: Context.Context<Exclude<R, SignalContext>>,
  options?: Observable.ObservableOptions,
) =>
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
    Effect.map((sideEffect) => sideEffect.cleanup()),
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
      "SideEffect.makeWithContext",
      {
        captureStackTrace: true,
      },
    ),
  );
