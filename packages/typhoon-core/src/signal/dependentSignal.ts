import { Array, Effect, pipe } from "effect";
import { Observable } from "../observability";
import type * as DependencySignal from "./dependencySignal";

export const DependentSymbol: unique symbol = Symbol(
  "Typhoon/Signal/Dependent",
);

export abstract class DependentSignal implements Observable.Observable {
  abstract readonly [DependentSymbol]: DependentSignal;
  abstract readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  abstract addDependency(
    dependency: DependencySignal.DependencySignal<unknown, unknown, unknown>,
  ): Effect.Effect<void, never, never>;
  abstract removeDependency(
    dependency: DependencySignal.DependencySignal<unknown, unknown, unknown>,
  ): Effect.Effect<void, never, never>;
  abstract clearDependencies(): Effect.Effect<void, never, never>;

  abstract getDependencies(): Effect.Effect<
    DependencySignal.DependencySignal<unknown, unknown, unknown>[],
    never,
    never
  >;

  abstract getReferenceForDependency(): Effect.Effect<
    WeakRef<DependentSignal> | DependentSignal,
    never,
    never
  >;
  abstract notify(): Effect.Effect<unknown, never, never>;
}

export const isDependentSignal = (signal: unknown): signal is DependentSignal =>
  Boolean(
    signal &&
      typeof signal === "object" &&
      DependentSymbol in signal &&
      signal[DependentSymbol] === signal,
  );

export const mask = (signal: DependentSignal) => signal;

export const getDependencyUpdateOrder = (
  dependent: DependentSignal,
): Effect.Effect<
  DependencySignal.DependencySignal<unknown, unknown, unknown>[],
  never,
  never
> =>
  pipe(
    Effect.Do,
    Effect.bind("thisDependencies", () => dependent.getDependencies()),
    Effect.bind("nestedDependencies", ({ thisDependencies }) =>
      pipe(
        Effect.all(
          thisDependencies.map((dependency) =>
            isDependentSignal(dependency as any)
              ? getDependencyUpdateOrder(
                  dependency as unknown as DependentSignal,
                )
              : Effect.succeed([]),
          ),
        ),
        Effect.map(Array.flatten),
      ),
    ),
    Effect.let("dependencies", ({ thisDependencies, nestedDependencies }) =>
      Array.appendAll(thisDependencies, nestedDependencies),
    ),
    Effect.map(({ dependencies }) => {
      const seen = new Set();
      return dependencies
        .reverse()
        .filter((item) => {
          if (seen.has(item)) return false;
          seen.add(item);
          return true;
        })
        .reverse();
    }),
    Observable.withSpan(dependent, "DependentSignal.getDependencyUpdateOrder", {
      captureStackTrace: true,
    }),
  );

export const reconcileAllDependencies = (
  dependent: DependentSignal,
): Effect.Effect<void, never, never> =>
  pipe(
    getDependencyUpdateOrder(dependent),
    Effect.flatMap((deps) =>
      Effect.forEach(deps, (dep) => dep.reconcile(), { discard: true }),
    ),
    Observable.withSpan(dependent, "DependentSignal.reconcileAllDependencies", {
      captureStackTrace: true,
    }),
  );
