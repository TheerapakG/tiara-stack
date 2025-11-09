import { Array, Effect, Effectable, pipe } from "effect";
import { Observable } from "../observability";
import type * as DependentSignal from "./dependentSignal";
import type { SignalContext } from "./signalContext";

export const DependencySymbol: unique symbol = Symbol(
  "Typhoon/Signal/Dependency",
);

export abstract class DependencySignal<A = never, E = never, R = never>
  extends Effectable.Class<A, E, R | SignalContext>
  implements Observable.Observable
{
  abstract readonly [DependencySymbol]: DependencySignal<A, E, R>;
  abstract readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  abstract addDependent(
    dependent:
      | WeakRef<DependentSignal.DependentSignal>
      | DependentSignal.DependentSignal,
  ): Effect.Effect<void, never, never>;
  abstract removeDependent(
    dependent:
      | WeakRef<DependentSignal.DependentSignal>
      | DependentSignal.DependentSignal,
  ): Effect.Effect<void, never, never>;
  abstract clearDependents(): Effect.Effect<void, never, never>;

  abstract getDependents(): Effect.Effect<
    (
      | WeakRef<DependentSignal.DependentSignal>
      | DependentSignal.DependentSignal
    )[],
    never,
    never
  >;

  abstract get value(): Effect.Effect<A, E, R | SignalContext>;
  abstract peek(): Effect.Effect<A, E, R>;

  abstract reconcile(): Effect.Effect<void, never, never>;
}

export const isDependencySignal = (
  signal: unknown,
): signal is DependencySignal =>
  Boolean(
    signal &&
      typeof signal === "object" &&
      DependencySymbol in signal &&
      signal[DependencySymbol] === signal,
  );

export const getDependentsUpdateOrder = (
  dependency: DependencySignal<unknown, unknown, unknown>,
): Effect.Effect<DependentSignal.DependentSignal[], never, never> =>
  pipe(
    Effect.Do,
    Effect.bind("thisDependents", () =>
      pipe(
        dependency.getDependents(),
        Effect.andThen(
          Array.map((dependent) =>
            dependent instanceof WeakRef ? dependent.deref() : dependent,
          ),
        ),
        Effect.andThen(Array.filter((dependent) => dependent !== undefined)),
      ),
    ),
    Effect.bind("nestedDependents", ({ thisDependents }) =>
      pipe(
        Effect.all(
          pipe(
            thisDependents,
            Array.filter((dependency) => isDependencySignal(dependency)),
            Array.map(getDependentsUpdateOrder),
          ),
        ),
        Effect.map(Array.flatten),
      ),
    ),
    Effect.let("dependents", ({ thisDependents, nestedDependents }) =>
      Array.appendAll(thisDependents, nestedDependents),
    ),
    Effect.map(({ dependents }) => {
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
    Observable.withSpan(
      dependency,
      "DependencySignal.getDependentsUpdateOrder",
      {
        captureStackTrace: true,
      },
    ),
  );

export const notifyAllDependents =
  (beforeNotify: (watched: boolean) => Effect.Effect<void, never, never>) =>
  (signal: DependencySignal<unknown, unknown, unknown>) =>
    pipe(
      Effect.Do,
      Effect.bind("dependents", () => getDependentsUpdateOrder(signal)),
      Effect.let("watched", ({ dependents }) =>
        dependents.some((dependent) => !isDependencySignal(dependent)),
      ),
      Effect.tap(signal.clearDependents()),
      Effect.tap(({ watched }) => beforeNotify(watched)),
      Effect.flatMap(({ dependents }) =>
        Effect.all(dependents.map((dependent) => dependent.notify())),
      ),
      Observable.withSpan(signal, "DependencySignal.notifyAllDependents", {
        captureStackTrace: true,
      }),
      Effect.ignore,
    );

export const mask = <A, E, R>(signal: DependencySignal<A, E, R>) => signal;
