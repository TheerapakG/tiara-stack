import { Context, Effect, Option, pipe, STM, TRef, TSet } from "effect";
import { Observable } from "../observability";
import type * as DependencySignal from "./dependencySignal";
import * as DependentSignal from "./dependentSignal";
import * as SignalService from "./signalService";

type SignalContextShape = {
  readonly signal: Option.Option<DependentSignal.DependentSignal>;
  readonly unchanged: Option.Option<
    TRef.TRef<
      TSet.TSet<DependencySignal.DependencySignal<unknown, unknown, unknown>>
    >
  >;
};
const SignalContextTag: Context.TagClass<
  SignalContext,
  "SignalContext",
  SignalContextShape
> = Context.Tag("SignalContext")<SignalContext, SignalContextShape>();
export class SignalContext extends SignalContextTag {}

const inheritUnchanged: STM.STM<
  Option.Option<
    TRef.TRef<
      TSet.TSet<DependencySignal.DependencySignal<unknown, unknown, unknown>>
    >
  >,
  never,
  never
> = pipe(
  STM.context<never>(),
  STM.map(Context.getOption(SignalContext)),
  STM.map(Option.flatMap((ctx) => ctx.unchanged)),
);

export const empty: STM.STM<
  Context.Tag.Service<SignalContext>,
  never,
  never
> = pipe(
  inheritUnchanged,
  STM.map((unchanged) => ({
    signal: Option.none(),
    unchanged,
  })),
);

export const makeWithEmptyUnchanged = pipe(
  TSet.empty<DependencySignal.DependencySignal<unknown, unknown, unknown>>(),
  STM.flatMap((set) => TRef.make(set)),
  STM.map((unchangedRef) => ({
    context: {
      signal: Option.none(),
      unchanged: Option.some(unchangedRef),
    },
    unchanged: unchangedRef,
  })),
);

export const markUnchanged = (
  dependency: DependencySignal.DependencySignal<unknown, unknown, unknown>,
) =>
  pipe(
    STM.context<never>(),
    STM.map(Context.getOption(SignalContext)),
    STM.map(Option.flatMap((ctx) => ctx.unchanged)),
    STM.flatMap((unchanged) =>
      pipe(
        unchanged,
        Option.match({
          onSome: (ref) =>
            pipe(
              TRef.get(ref),
              STM.flatMap((set) => TSet.add(set, dependency)),
              STM.asVoid,
            ),
          onNone: () => STM.void,
        }),
      ),
    ),
  );

export const fromDependent = (
  dependent: DependentSignal.DependentSignal,
): STM.STM<Context.Tag.Service<SignalContext>, never, never> =>
  pipe(
    inheritUnchanged,
    STM.map((unchanged) => ({
      signal: Option.some(dependent),
      unchanged,
    })),
  );

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
      Effect.tap(() => Effect.log("tracked effect for signal", ctx.signal)),
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
          _tag: "UnknownSignal" as const,
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
