import { Array, Effect, pipe, STM, TSet } from "effect";
import { Observable } from "../observability";
import type * as DependencySignal from "./dependencySignal";
import type * as SignalService from "./signalService";
import type * as SignalContext from "./signalContext";

export const DependentSymbol: unique symbol = Symbol(
  "Typhoon/Signal/Dependent",
);

export abstract class DependentSignal implements Observable.Observable {
  abstract readonly _tag: string;
  abstract readonly [DependentSymbol]: DependentSignal;
  abstract readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  abstract addDependency(
    dependency: DependencySignal.DependencySignal<unknown, unknown, unknown>,
  ): STM.STM<void, never, never>;
  abstract removeDependency(
    dependency: DependencySignal.DependencySignal<unknown, unknown, unknown>,
  ): STM.STM<void, never, never>;
  abstract clearDependencies(): STM.STM<void, never, never>;

  abstract getDependencies(): STM.STM<
    TSet.TSet<DependencySignal.DependencySignal<unknown, unknown, unknown>>,
    never,
    never
  >;

  abstract getReferenceForDependency(): STM.STM<
    WeakRef<DependentSignal> | DependentSignal,
    never,
    never
  >;
  abstract notify(): Effect.Effect<
    unknown,
    never,
    SignalService.SignalService | SignalContext.SignalContext
  >;
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
): STM.STM<
  DependencySignal.DependencySignal<unknown, unknown, unknown>[],
  never,
  never
> =>
  pipe(
    STM.Do,
    STM.bind("thisDependencies", () =>
      pipe(dependent.getDependencies(), STM.flatMap(TSet.toArray)),
    ),
    STM.bind("nestedDependencies", ({ thisDependencies }) =>
      pipe(
        STM.all(
          thisDependencies.map((dependency) =>
            isDependentSignal(dependency as any)
              ? getDependencyUpdateOrder(
                  dependency as unknown as DependentSignal,
                )
              : STM.succeed([]),
          ),
        ),
        STM.map(Array.flatten),
      ),
    ),
    STM.let("dependencies", ({ thisDependencies, nestedDependencies }) =>
      Array.appendAll(thisDependencies, nestedDependencies),
    ),
    STM.map(({ dependencies }) => {
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
  );

export const reconcileAllDependencies = (
  dependent: DependentSignal,
): STM.STM<void, never, never> =>
  pipe(
    getDependencyUpdateOrder(dependent),
    STM.flatMap((deps) =>
      STM.forEach(deps, (dep) => dep.reconcile(), { discard: true }),
    ),
  );
