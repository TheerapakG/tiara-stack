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
  Exit,
} from "effect";

class UnsafeRunState<A, E> extends Data.TaggedClass("RunState")<{
  status: "stopped" | "pending" | "ready";
  runFiber: Option.Option<Fiber.Fiber<A, E>>;
}> {}

export class RunState<A, E> extends Data.TaggedClass("RunState")<{
  semaphore: Effect.Semaphore;
  state: SynchronizedRef.SynchronizedRef<UnsafeRunState<A, E>>;
}> {}

export const make = <A = never, E = never>() =>
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
    Effect.map(({ semaphore, state }) => new RunState({ semaphore, state })),
  );

export const start =
  <A, E, R>(effect: Effect.Effect<A, E, R>, runtime: Runtime.Runtime<R>) =>
  (runState: RunState<A, E>) =>
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
            Effect.addFinalizer((exit) =>
              Effect.unless(() => Exit.isInterrupted(exit))(stop(runState)),
            ),
            Effect.andThen(effect),
            Effect.scoped,
          ),
        ),
        (fiber) =>
          SynchronizedRef.set(
            runState.state,
            new UnsafeRunState<A, E>({
              status: "ready",
              runFiber: Option.some(fiber),
            }),
          ),
      ),
    );

export const stop = <A, E>(runState: RunState<A, E>) =>
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
      SynchronizedRef.get(runState.state),
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

export const status = <A, E>(runState: RunState<A, E>) =>
  pipe(
    SynchronizedRef.get(runState.state),
    Effect.map(({ status }) => status),
  );
