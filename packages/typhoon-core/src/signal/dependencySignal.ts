import { Effect, Effectable, STM, TSet } from "effect";
import { Observable } from "../observability";
import * as DependentSignal from "./dependentSignal";
import * as SignalService from "./signalService";

export const DependencySymbol: unique symbol = Symbol("Typhoon/Signal/Dependency");

export abstract class DependencySignal<A = never, E = never, R = never>
  extends Effectable.Class<A, E, R | SignalService.SignalService>
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

  abstract value(): Effect.Effect<A, E, R | SignalService.SignalService>;
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

export const mask = <A, E, R>(signal: DependencySignal<A, E, R>) => signal;
