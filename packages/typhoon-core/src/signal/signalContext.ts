import { Context, Effect, Option, pipe, STM } from "effect";
import { Observable } from "../observability";
import type * as DependencySignal from "./dependencySignal";
import * as DependentSignal from "./dependentSignal";
import * as SignalService from "./signalService";

type SignalContextShape = {
  readonly signal: Option.Option<DependentSignal.DependentSignal>;
};
const SignalContextTag: Context.TagClass<
  SignalContext,
  "SignalContext",
  SignalContextShape
> = Context.Tag("SignalContext")<SignalContext, SignalContextShape>();
export class SignalContext extends SignalContextTag {}

export const empty = {
  signal: Option.none(),
};

export const fromDependent = (
  dependent: DependentSignal.DependentSignal,
): Context.Tag.Service<SignalContext> => ({
  signal: Option.some(dependent),
});

export const bindDependency = (
  dependency: DependencySignal.DependencySignal<unknown, unknown, unknown>,
): STM.STM<void, never, SignalContext> =>
  pipe(
    SignalContext,
    STM.flatMap(({ signal }) =>
      pipe(
        signal,
        Option.match({
          onSome: (signal) =>
            STM.all([
              pipe(
                signal.getReferenceForDependency(),
                STM.flatMap((reference) => dependency.addDependent(reference)),
              ),
              signal.addDependency(dependency),
            ]),
          onNone: () => STM.void,
        }),
      ),
    ),
    STM.asVoid,
  );

export const runAndTrackEffect =
  <A = never, E = never, R = never>(effect: Effect.Effect<A, E, R>) =>
  (
    ctx: Context.Tag.Service<SignalContext>,
  ): Effect.Effect<A, E, Exclude<R, SignalContext>> => {
    return pipe(
      effect,
      Effect.provideService(SignalContext, ctx),
      Effect.tap(() =>
        pipe(
          ctx.signal,
          Option.match({
            onSome: (signal) =>
              DependentSignal.reconcileAllDependencies(signal),
            onNone: () => Effect.void,
          }),
        ),
      ),
      Observable.withSpan(
        Option.getOrElse(ctx.signal, () => ({
          [Observable.ObservableSymbol]: {},
        })),
        "SignalContext.runAndTrackEffect",
        {
          captureStackTrace: true,
        },
      ),
    );
  };

export type MaybeSignalEffect<A = never, E = never, R = never> =
  | A
  | Effect.Effect<A, E, R | SignalContext | SignalService.SignalService>;

export type MaybeSignalEffectValue<X> =
  X extends Effect.Effect<any, any, any>
    ? Effect.Effect.AsEffect<X>
    : Effect.Effect<X, never, never>;

export const getMaybeSignalEffectValue = <X>(
  value: X,
): MaybeSignalEffectValue<X> =>
  (Effect.isEffect(value)
    ? value
    : Effect.succeed(value)) as MaybeSignalEffectValue<X>;
