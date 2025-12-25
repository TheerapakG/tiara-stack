import {
  Array,
  Effect,
  Effectable,
  Number,
  pipe,
  Option,
  STM,
  TRef,
  TSet,
  HashSet,
} from "effect";
import { Observable } from "../observability";
import type * as DependentSignal from "./dependentSignal";
import * as SignalContext from "./signalContext";
import * as SignalService from "./signalService";

export const DependencySymbol: unique symbol = Symbol(
  "Typhoon/Signal/Dependency",
);

export abstract class DependencySignal<A = never, E = never, R = never>
  extends Effectable.Class<
    A,
    E,
    R | SignalContext.SignalContext | SignalService.SignalService
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
    TSet.TSet<
      WeakRef<DependentSignal.DependentSignal> | DependentSignal.DependentSignal
    >,
    never,
    never
  >;

  abstract value(): Effect.Effect<
    A,
    E,
    R | SignalContext.SignalContext | SignalService.SignalService
  >;
  abstract peek(): Effect.Effect<A, E, R | SignalService.SignalService>;

  abstract reconcile(): STM.STM<void, never, never>;
}

export const isDependencySignal = (
  signal: unknown,
): signal is DependencySignal<unknown, unknown, unknown> =>
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
        STM.flatMap(TSet.toArray),
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

const computeChanged = (
  changed: TSet.TSet<DependencySignal<unknown, unknown, unknown>>,
  dependent: DependentSignal.DependentSignal,
) =>
  pipe(
    TSet.toHashSet(changed),
    STM.flatMap((changed) =>
      pipe(
        SignalContext.SignalContext,
        STM.flatMap((context) =>
          pipe(
            context.unchanged,
            Option.match({
              onSome: (unchanged) => TRef.get(unchanged),
              onNone: () =>
                TSet.empty<DependencySignal<unknown, unknown, unknown>>(),
            }),
          ),
        ),
        STM.flatMap(TSet.toHashSet),
        STM.map((unchanged) => HashSet.difference(changed, unchanged)),
      ),
    ),
    STM.flatMap((changed) =>
      pipe(
        dependent.getDependencies(),
        STM.flatMap(TSet.toHashSet),
        STM.map((dependencies) => HashSet.intersection(dependencies, changed)),
      ),
    ),
  );

export const notifyAllDependents =
  (
    beforeNotify: (watched: boolean) => Effect.Effect<void, never, never>,
  ): ((
    signal: DependencySignal<unknown, unknown, unknown>,
  ) => Effect.Effect<void, never, SignalService.SignalService>) =>
  (signal) =>
    pipe(
      STM.all({
        dependents: getDependentsUpdateOrder(signal),
        context: SignalContext.makeWithEmptyUnchanged,
        changed: TSet.make(signal),
      }),
      STM.let("watched", ({ dependents }) =>
        dependents.some((dependent) => !isDependencySignal(dependent)),
      ),
      STM.tap(() => signal.clearDependents()),
      STM.commit,
      Effect.tap(({ watched }) => beforeNotify(watched)),
      Effect.andThen(({ dependents, context, changed }) =>
        Effect.forEach(
          dependents,
          (dependent) =>
            pipe(
              computeChanged(changed, dependent),
              STM.map(HashSet.size),
              STM.map((size) => !Number.Equivalence(size, 0)),
              STM.commit,
              Effect.tap((changed) =>
                changed
                  ? dependent.notify()
                  : isDependencySignal(dependent)
                    ? pipe(
                        TRef.get(context.unchanged),
                        STM.flatMap(
                          TSet.add<DependencySignal<unknown, unknown, unknown>>(
                            dependent,
                          ),
                        ),
                        STM.asVoid,
                        STM.commit,
                      )
                    : Effect.void,
              ),
              Effect.provideService(
                SignalContext.SignalContext,
                context.context,
              ),
            ),
          { discard: true },
        ),
      ),
      Observable.withSpan(signal, "DependencySignal.notifyAllDependents", {
        captureStackTrace: true,
      }),
    );

export const mask = <A, E, R>(signal: DependencySignal<A, E, R>) => signal;
