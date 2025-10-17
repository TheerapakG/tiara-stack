import { Context, Effect, pipe } from "effect";
import { Observable } from "../observability";
import type * as DependencySignal from "./dependencySignal";
import type * as DependentSignal from "./dependentSignal";

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
        dependency.addDependent(signal),
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
      Observable.withSpan(ctx.signal, "SignalContext.runAndTrackEffect", {
        captureStackTrace: true,
      }),
    );
  };
