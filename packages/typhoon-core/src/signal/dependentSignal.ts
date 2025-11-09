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
