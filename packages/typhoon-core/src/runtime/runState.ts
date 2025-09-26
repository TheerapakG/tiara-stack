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
} from "effect";

class UnsafeRunState<A, E> extends Data.TaggedClass("RunState")<{
  status: "stopped" | "pending" | "ready";
  runFiber: Option.Option<Fiber.Fiber<A, E>>;
}> {}

export class RunState<
  Context = never,
  A = never,
  E = never,
  R = never,
> extends Data.TaggedClass("RunState")<{
  semaphore: Effect.Semaphore;
  effect: (ctx: Context, runtime: Runtime.Runtime<R>) => Effect.Effect<A, E, R>;
  finalizer: (
    ctx: Context,
    runtime: Runtime.Runtime<R>,
  ) => Effect.Effect<unknown, never, never>;
  state: SynchronizedRef.SynchronizedRef<UnsafeRunState<A, E>>;
}> {}

export const make = <Context = never, A = never, E = never, R = never>(
  effect: (ctx: Context, runtime: Runtime.Runtime<R>) => Effect.Effect<A, E, R>,
  finalizer: (ctx: Context) => Effect.Effect<unknown, never, never>,
) =>
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
    Effect.map(
      ({ semaphore, state }) =>
        new RunState({ semaphore, effect, finalizer, state }),
    ),
  );

export const start =
  <Context, R>(ctx: Context, runtime: Runtime.Runtime<R>) =>
  <A, E>(runState: RunState<Context, A, E, R>) =>
    Effect.whenEffect(
      runState.semaphore.withPermits(1)(
        pipe(
          SynchronizedRef.getAndUpdateSome(runState.state, (state) =>
            pipe(
              Option.some(state),
              Option.filter(({ status }) =>
                String.Equivalence(status, "stopped"),
              ),
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
  <Context, R>(ctx: Context, runtime: Runtime.Runtime<R>) =>
  <A, E>(runState: RunState<Context, A, E, R>) =>
    Effect.whenEffect(
      runState.semaphore.withPermits(1)(
        pipe(
          SynchronizedRef.getAndUpdateSome(runState.state, (state) =>
            pipe(
              Option.some(state),
              Option.filter(({ status }) =>
                String.Equivalence(status, "ready"),
              ),
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
        Effect.tap(({ runFiber }) =>
          Effect.transposeMapOption(runFiber, Fiber.interrupt),
        ),
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

export const status = <Context, A, E, R>(
  runState: RunState<Context, A, E, R>,
) =>
  pipe(
    SynchronizedRef.get(runState.state),
    Effect.map(({ status }) => status),
  );
