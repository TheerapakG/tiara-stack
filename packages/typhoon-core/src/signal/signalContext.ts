import { Context, Effect, pipe } from "effect";
import { Observable } from "../observability";
import type * as DependencySignal from "./dependencySignal";
import * as DependentSignal from "./dependentSignal";

type SignalContextShape = {
  readonly signal: DependentSignal.DependentSignal;
};
const SignalContextTag: Context.TagClass<
  SignalContext,
  "SignalContext",
  SignalContextShape
> = Context.Tag("SignalContext")<SignalContext, SignalContextShape>();
export class SignalContext extends SignalContextTag {}

export const fromDependent = (
  dependent: DependentSignal.DependentSignal,
): Context.Tag.Service<SignalContext> => ({
  signal: dependent,
});

export const getSignal = (
  dependency: DependencySignal.DependencySignal<unknown, unknown, unknown>,
): Effect.Effect<DependentSignal.DependentSignal, never, SignalContext> =>
  pipe(
    SignalContext,
    Effect.map(({ signal }) => signal),
    Observable.withSpan(dependency, "SignalContext.getSignal", {
      captureStackTrace: true,
    }),
  );

export const bindScopeDependency = (
  dependency: DependencySignal.DependencySignal<unknown, unknown, unknown>,
): Effect.Effect<void, never, SignalContext> =>
  pipe(
    getSignal(dependency),
    Effect.flatMap((signal) =>
      Effect.all([
        pipe(
          signal.getReferenceForDependency(),
          Effect.andThen((reference) => dependency.addDependent(reference)),
        ),
        signal.addDependency(dependency),
      ]),
    ),
    Observable.withSpan(dependency, "SignalContext.bindScopeDependency", {
      captureStackTrace: true,
    }),
    Effect.ignore,
  );

export const runAndTrackEffect =
  <A = never, E = never, R = never>(effect: Effect.Effect<A, E, R>) =>
  (
    ctx: Context.Tag.Service<SignalContext>,
  ): Effect.Effect<A, E, Exclude<R, SignalContext>> => {
    return pipe(
      effect,
      Effect.provideService(SignalContext, ctx),
      Effect.tap(() => DependentSignal.reconcileAllDependencies(ctx.signal)),
      Observable.withSpan(ctx.signal, "SignalContext.runAndTrackEffect", {
        captureStackTrace: true,
      }),
    );
  };

export type MaybeSignalEffect<A = never, E = never, R = never> =
  | A
  | Effect.Effect<A, E, R | SignalContext>;

export type MaybeSignalEffectValue<X> = [X] extends [
  Effect.Effect<infer A1, infer E1, infer R1>,
]
  ? Effect.Effect<A1, E1, R1>
  : Effect.Effect<X, never, never>;

export const getMaybeSignalEffectValue = <X>(
  value: X,
): MaybeSignalEffectValue<X> =>
  (Effect.isEffect(value)
    ? value
    : Effect.succeed(value)) as MaybeSignalEffectValue<X>;
