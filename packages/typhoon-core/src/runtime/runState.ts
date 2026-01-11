import {
  Data,
  Option,
  Fiber,
  Effect,
  Runtime,
  pipe,
  String,
  Struct,
  SynchronizedRef,
  Scope,
} from "effect";

export interface RunStateContextTypeLambda {
  readonly R: unknown;
}

export type RunStateContextKind<F extends RunStateContextTypeLambda, R> = F extends {
  readonly type: unknown;
}
  ? (F & {
      readonly R: R;
    })["type"]
  : never;

type UnsafeRunStateData<A, E> = {
  status: "stopped" | "pending" | "ready";
  runFiber: Option.Option<Fiber.Fiber<A, E>>;
};
const UnsafeRunStateTaggedClass: new <A, E>(
  args: Readonly<UnsafeRunStateData<A, E>>,
) => Readonly<UnsafeRunStateData<A, E>> & { readonly _tag: "UnsafeRunState" } =
  Data.TaggedClass("UnsafeRunState");
class UnsafeRunState<A, E> extends UnsafeRunStateTaggedClass<A, E> {}

type RunStateData<F extends RunStateContextTypeLambda, A, E, DefaultR = never> = {
  semaphore: Effect.Semaphore;
  effect: <R>(
    ctx: RunStateContextKind<F, R>,
    runtime: Runtime.Runtime<R | DefaultR>,
  ) => Effect.Effect<A, E, R>;
  finalizer: <R>(
    ctx: RunStateContextKind<F, R>,
    runtime: Runtime.Runtime<R | DefaultR>,
  ) => Effect.Effect<unknown, never, never>;
  state: SynchronizedRef.SynchronizedRef<UnsafeRunState<A, E>>;
};
const RunStateTaggedClass: new <F extends RunStateContextTypeLambda, A, E, DefaultR = never>(
  args: Readonly<RunStateData<F, A, E, DefaultR>>,
) => Readonly<RunStateData<F, A, E, DefaultR>> & { readonly _tag: "RunState" } =
  Data.TaggedClass("RunState");
export class RunState<
  F extends RunStateContextTypeLambda,
  A = never,
  E = never,
  DefaultR = never,
> extends RunStateTaggedClass<F, A, E, DefaultR> {}

export const make = <F extends RunStateContextTypeLambda, A = never, E = never, DefaultR = never>(
  effect: <R>(
    ctx: RunStateContextKind<F, R>,
    runtime: Runtime.Runtime<R | DefaultR>,
  ) => Effect.Effect<A, E, R>,
  finalizer: <R>(
    ctx: RunStateContextKind<F, R>,
    runtime: Runtime.Runtime<R | DefaultR>,
  ) => Effect.Effect<unknown, never, never>,
): Effect.Effect<RunState<F, A, E, DefaultR>, never, never> =>
  pipe(
    Effect.Do,
    Effect.bind("semaphore", () => Effect.makeSemaphore(1)),
    Effect.bind("state", () =>
      SynchronizedRef.make(
        new UnsafeRunState<A, E>({
          status: "stopped",
          runFiber: Option.none(),
        }),
      ),
    ),
    Effect.map(({ semaphore, state }) => new RunState({ semaphore, effect, finalizer, state })),
  );

export const start =
  <F extends RunStateContextTypeLambda, R, DefaultR = never>(
    ctx: RunStateContextKind<F, R>,
    runtime: Runtime.Runtime<R | DefaultR>,
  ) =>
  <A, E>(runState: RunState<F, A, E, DefaultR>): Effect.Effect<Option.Option<A>, E, Scope.Scope> =>
    Effect.whenEffect(
      runState.semaphore.withPermits(1)(
        pipe(
          SynchronizedRef.getAndUpdateSome(runState.state, (state) =>
            pipe(
              Option.some(state),
              Option.filter(({ status }) => String.Equivalence(status, "stopped")),
              Option.map(
                (state) =>
                  new UnsafeRunState<A, E>(
                    Struct.evolve(state, { status: () => "pending" as const }),
                  ),
              ),
            ),
          ),
          Effect.map(({ status }) => String.Equivalence(status, "stopped")),
        ),
      ),
    )(
      pipe(
        Runtime.runFork(
          runtime,
          pipe(
            Effect.addFinalizer(() => stop(ctx, runtime)(runState)),
            Effect.andThen(runState.effect(ctx, runtime)),
            Effect.scoped,
          ),
        ),
        (fiber) =>
          pipe(
            Effect.addFinalizer(() => stop(ctx, runtime)(runState)),
            Effect.andThen(
              SynchronizedRef.set(
                runState.state,
                new UnsafeRunState<A, E>({
                  status: "ready",
                  runFiber: Option.some(fiber),
                }),
              ),
            ),
            Effect.as(fiber),
          ),
        Effect.flatMap((fiber) => Fiber.join(fiber)),
      ),
    );

export const stop =
  <F extends RunStateContextTypeLambda, R, DefaultR = never>(
    ctx: RunStateContextKind<F, R>,
    runtime: Runtime.Runtime<R | DefaultR>,
  ) =>
  <A, E>(runState: RunState<F, A, E, DefaultR>): Effect.Effect<Option.Option<void>, never, never> =>
    Effect.whenEffect(
      runState.semaphore.withPermits(1)(
        pipe(
          SynchronizedRef.getAndUpdateSome(runState.state, (state) =>
            pipe(
              Option.some(state),
              Option.filter(({ status }) => String.Equivalence(status, "ready")),
              Option.map(
                (state) =>
                  new UnsafeRunState<A, E>(
                    Struct.evolve(state, { status: () => "pending" as const }),
                  ),
              ),
            ),
          ),
          Effect.map(({ status }) => String.Equivalence(status, "ready")),
        ),
      ),
    )(
      pipe(
        runState.finalizer(ctx, runtime),
        Effect.andThen(SynchronizedRef.get(runState.state)),
        Effect.tap(({ runFiber }) => Effect.transposeMapOption(runFiber, Fiber.interrupt)),
        Effect.andThen(() =>
          SynchronizedRef.set(
            runState.state,
            new UnsafeRunState<A, E>({
              status: "stopped",
              runFiber: Option.none(),
            }),
          ),
        ),
      ),
    );

export const status = <F extends RunStateContextTypeLambda, A, E, DefaultR = never>(
  runState: RunState<F, A, E, DefaultR>,
): Effect.Effect<"stopped" | "pending" | "ready", never, never> =>
  pipe(
    SynchronizedRef.get(runState.state),
    Effect.map(({ status }) => status),
  );
