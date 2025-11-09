import { Effect } from "effect";
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
  Effect.gen(function* () {
    const visited = new Set<
      DependencySignal.DependencySignal<unknown, unknown, unknown>
    >();
    const ordered: Array<
      DependencySignal.DependencySignal<unknown, unknown, unknown>
    > = [];

    const dfs = (node: DependentSignal): Effect.Effect<void, never, never> =>
      Effect.flatMap(node.getDependencies(), (deps) =>
        Effect.forEach(
          deps,
          (dep) =>
            Effect.suspend(() => {
              // Avoid revisiting
              if (visited.has(dep as any)) return Effect.void;
              visited.add(dep as any);
              ordered.push(dep as any);
              return isDependentSignal(dep as any)
                ? dfs(dep as unknown as DependentSignal)
                : Effect.void;
            }),
          { discard: true },
        ),
      );

    yield* dfs(dependent);
    return ordered;
  });

export const reconcileAllDependencies = (
  dependent: DependentSignal,
): Effect.Effect<void, never, never> =>
  Effect.flatMap(getDependencyUpdateOrder(dependent), (deps) =>
    Effect.forEach(
      deps,
      (dep) => (dep.reconcile ? dep.reconcile() : Effect.void),
      { discard: true },
    ),
  );
