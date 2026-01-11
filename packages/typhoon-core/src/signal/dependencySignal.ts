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
  TMap,
} from "effect";
import { Observable } from "../observability";
import * as DependentSignal from "./dependentSignal";
import * as SignalContext from "./signalContext";
import * as SignalService from "./signalService";

export const DependencySymbol: unique symbol = Symbol("Typhoon/Signal/Dependency");

export abstract class DependencySignal<A = never, E = never, R = never>
  extends Effectable.Class<A, E, R | SignalContext.SignalContext | SignalService.SignalService>
  implements Observable.Observable
{
  abstract readonly _tag: string;
  abstract readonly [DependencySymbol]: DependencySignal<A, E, R>;
  abstract readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  abstract addDependent(
    dependent: WeakRef<DependentSignal.DependentSignal> | DependentSignal.DependentSignal,
  ): STM.STM<void, never, never>;
  abstract removeDependent(
    dependent: WeakRef<DependentSignal.DependentSignal> | DependentSignal.DependentSignal,
  ): STM.STM<void, never, never>;
  abstract clearDependents(): STM.STM<void, never, never>;

  abstract getDependents(): STM.STM<
    TSet.TSet<WeakRef<DependentSignal.DependentSignal> | DependentSignal.DependentSignal>,
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

export const buildDependentsSnapshot = (
  dependency: DependencySignal<unknown, unknown, unknown> | DependentSignal.DependentSignal,
): STM.STM<
  TMap.TMap<
    DependencySignal<unknown, unknown, unknown> | DependentSignal.DependentSignal,
    {
      dependencies: DependencySignal<unknown, unknown, unknown>[];
      dependents: DependentSignal.DependentSignal[];
    }
  >,
  never,
  never
> =>
  pipe(
    STM.Do,
    STM.bind("dependencies", () =>
      DependentSignal.isDependentSignal(dependency)
        ? pipe(dependency.getDependencies(), STM.flatMap(TSet.toArray))
        : STM.succeed([]),
    ),
    STM.bind("dependents", () =>
      isDependencySignal(dependency)
        ? pipe(dependency.getDependents(), STM.flatMap(TSet.toArray))
        : STM.succeed([]),
    ),
    STM.let("derefDependents", ({ dependents }) =>
      pipe(
        dependents,
        Array.map((dependent) => (dependent instanceof WeakRef ? dependent.deref() : dependent)),
        Array.filter((dependent) => dependent !== undefined),
      ),
    ),
    STM.bind("dependentsMap", ({ dependencies, derefDependents }) =>
      TMap.make([dependency, { dependencies, dependents: derefDependents }]),
    ),
    STM.tap(({ derefDependents, dependentsMap }) =>
      STM.forEach(derefDependents, (dependent) =>
        pipe(
          buildDependentsSnapshot(dependent),
          STM.flatMap(TMap.toArray),
          STM.flatMap(STM.forEach(([key, value]) => TMap.setIfAbsent(dependentsMap, key, value))),
        ),
      ),
    ),
    STM.map(({ dependentsMap }) => dependentsMap),
  );

export const getDependentsUpdateOrder = (
  dependentsSnapshot: TMap.TMap<
    DependencySignal<unknown, unknown, unknown> | DependentSignal.DependentSignal,
    {
      dependencies: DependencySignal<unknown, unknown, unknown>[];
      dependents: DependentSignal.DependentSignal[];
    }
  >,
  dependency: DependencySignal<unknown, unknown, unknown>,
): STM.STM<DependentSignal.DependentSignal[], never, never> =>
  pipe(
    STM.Do,
    STM.bind("thisDependents", () =>
      pipe(
        TMap.get(dependentsSnapshot, dependency),
        STM.map(Option.map(({ dependents }) => dependents)),
        STM.map(Option.getOrElse(() => [] as DependentSignal.DependentSignal[])),
      ),
    ),
    STM.bind("nestedDependents", ({ thisDependents }) =>
      pipe(
        STM.all(
          pipe(
            thisDependents,
            Array.filter((dependency) => isDependencySignal(dependency)),
            Array.map((dependency) => getDependentsUpdateOrder(dependentsSnapshot, dependency)),
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
  dependentsSnapshot: TMap.TMap<
    DependencySignal<unknown, unknown, unknown> | DependentSignal.DependentSignal,
    {
      dependencies: DependencySignal<unknown, unknown, unknown>[];
      dependents: DependentSignal.DependentSignal[];
    }
  >,
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
              onNone: () => TSet.empty<DependencySignal<unknown, unknown, unknown>>(),
            }),
          ),
        ),
        STM.flatMap(TSet.toHashSet),
        STM.map((unchanged) => HashSet.difference(changed, unchanged)),
      ),
    ),
    STM.flatMap((changed) =>
      pipe(
        TMap.get(dependentsSnapshot, dependent),
        STM.map(
          Option.match({
            onSome: ({ dependencies }) => dependencies,
            onNone: () => [],
          }),
        ),
        STM.map(HashSet.fromIterable),
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
        dependentsSnapshot: buildDependentsSnapshot(signal),
        context: SignalContext.makeWithEmptyUnchanged,
        changed: TSet.make(signal),
      }),
      STM.bind("dependents", ({ dependentsSnapshot }) =>
        getDependentsUpdateOrder(dependentsSnapshot, signal),
      ),
      STM.let("watched", ({ dependents }) =>
        dependents.some((dependent) => !isDependencySignal(dependent)),
      ),
      STM.tap(() => signal.clearDependents()),
      STM.commit,
      Effect.tap(({ watched }) => beforeNotify(watched)),
      Effect.andThen(({ dependentsSnapshot, dependents, context, changed }) =>
        Effect.forEach(dependents, (dependent) =>
          pipe(
            computeChanged(changed, dependentsSnapshot, dependent),
            STM.map(HashSet.size),
            STM.map((size) => !Number.Equivalence(size, 0)),
            STM.tap(() =>
              isDependencySignal(dependent) ? TSet.add(changed, dependent) : STM.void,
            ),
            STM.commit,
            Effect.tap((changed) =>
              changed
                ? dependent.notify()
                : isDependencySignal(dependent)
                  ? pipe(
                      TRef.get(context.unchanged),
                      STM.flatMap(TSet.add<DependencySignal<unknown, unknown, unknown>>(dependent)),
                      STM.asVoid,
                      STM.commit,
                    )
                  : Effect.void,
            ),
            Effect.provideService(SignalContext.SignalContext, context.context),
          ),
        ),
      ),
      Observable.withSpan(signal, "DependencySignal.notifyAllDependents", {
        captureStackTrace: true,
      }),
    );

export const mask = <A, E, R>(signal: DependencySignal<A, E, R>) => signal;
