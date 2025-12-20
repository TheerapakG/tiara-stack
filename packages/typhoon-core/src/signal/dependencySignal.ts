import { Array, Effect, Effectable, pipe, STM } from "effect";
import { Observable } from "../observability";
import type * as DependentSignal from "./dependentSignal";
import { SignalContext } from "./signalContext";
import * as SignalService from "./signalService";

export const DependencySymbol: unique symbol = Symbol(
  "Typhoon/Signal/Dependency",
);

export abstract class DependencySignal<A = never, E = never, R = never>
  extends Effectable.Class<
    A,
    E,
    R | SignalContext | SignalService.SignalService
  >
  implements Observable.Observable
{
  abstract readonly [DependencySymbol]: DependencySignal<A, E, R>;
  abstract readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  abstract addDependent(
    dependent:
      | WeakRef<DependentSignal.DependentSignal>
      | DependentSignal.DependentSignal,
  ): STM.STM<void, never, never>;
  abstract removeDependent(
    dependent:
      | WeakRef<DependentSignal.DependentSignal>
      | DependentSignal.DependentSignal,
  ): STM.STM<void, never, never>;
  abstract clearDependents(): STM.STM<void, never, never>;

  abstract getDependents(): STM.STM<
    (
      | WeakRef<DependentSignal.DependentSignal>
      | DependentSignal.DependentSignal
    )[],
    never,
    never
  >;

  abstract value(): Effect.Effect<
    A,
    E,
    R | SignalContext | SignalService.SignalService
  >;
  abstract peek(): Effect.Effect<A, E, R | SignalService.SignalService>;

  abstract reconcile(): STM.STM<void, never, never>;
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
): STM.STM<DependentSignal.DependentSignal[], never, never> =>
  pipe(
    STM.Do,
    STM.bind("thisDependents", () =>
      pipe(
        dependency.getDependents(),
        STM.map(
          Array.map((dependent) =>
            dependent instanceof WeakRef ? dependent.deref() : dependent,
          ),
        ),
        STM.map(Array.filter((dependent) => dependent !== undefined)),
      ),
    ),
    STM.bind("nestedDependents", ({ thisDependents }) =>
      pipe(
        STM.all(
          pipe(
            thisDependents,
            Array.filter((dependency) => isDependencySignal(dependency)),
            Array.map(getDependentsUpdateOrder),
          ),
        ),
        STM.map(Array.flatten),
      ),
    ),
    STM.let("dependents", ({ thisDependents, nestedDependents }) =>
      Array.appendAll(thisDependents, nestedDependents),
    ),
    STM.map(({ dependents }) => {
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
  );

export const notifyAllDependents =
  (beforeNotify: (watched: boolean) => Effect.Effect<void, never, never>) =>
  (signal: DependencySignal<unknown, unknown, unknown>) =>
    pipe(
      STM.Do,
      STM.bind("dependents", () => getDependentsUpdateOrder(signal)),
      STM.let("watched", ({ dependents }) =>
        dependents.some((dependent) => !isDependencySignal(dependent)),
      ),
      STM.tap(() => signal.clearDependents()),
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
