import {
  Context,
  Deferred,
  Effect,
  FiberRef,
  pipe,
  Queue,
  Scope,
} from "effect";
import { Observable } from "../observability";
import { DependencySignal, notifyAllDependents } from "./dependencySignal";
import { SignalContext, runAndTrackEffect } from "./signalContext";

type NotifyRequest = {
  readonly signal: DependencySignal<unknown, unknown, unknown>;
  readonly beforeNotify: (
    watched: boolean,
  ) => Effect.Effect<void, never, never>;
};

type RunTrackedRequest<A, E> = {
  readonly effect: Effect.Effect<A, E, SignalContext>;
  readonly ctx: Context.Tag.Service<SignalContext>;
};

type WorkItem =
  | { readonly _tag: "notify"; readonly request: NotifyRequest }
  | {
      readonly _tag: "runTracked";
      readonly deferred: Deferred.Deferred<unknown, unknown>;
      readonly request: RunTrackedRequest<unknown, unknown>;
    };

type SignalServiceInterface = {
  enqueueNotify: (request: NotifyRequest) => Effect.Effect<void, never, never>;
  _enqueueRunTracked: <A, E>(
    request: RunTrackedRequest<A, E>,
  ) => Effect.Effect<A, E, never>;
};

const signalServiceDefinition: {
  scoped: Effect.Effect<SignalServiceInterface, never, Scope.Scope>;
  accessors: true;
  dependencies: [];
} = {
  scoped: pipe(
    Effect.all({
      queue: Queue.unbounded<WorkItem>(),
      workerFiberRef: FiberRef.make(false),
    }),
    Effect.tap(({ queue, workerFiberRef }) =>
      pipe(
        Queue.take(queue),
        Effect.flatMap((item) =>
          Effect.locally(
            workerFiberRef,
            true,
          )(
            item._tag === "notify"
              ? pipe(
                  notifyAllDependents(item.request.beforeNotify)(
                    item.request.signal,
                  ),
                  Effect.catchAllCause((cause) => Effect.logError(cause)),
                )
              : pipe(
                  runAndTrackEffect(item.request.effect)(item.request.ctx),
                  Effect.intoDeferred(item.deferred),
                  Effect.catchAllCause((cause) => Effect.logError(cause)),
                ),
          ),
        ),
        Effect.forever,
        Effect.withSpan("SignalService.worker", {
          captureStackTrace: true,
        }),
        Effect.forkScoped,
      ),
    ),
    Effect.map(({ queue, workerFiberRef }) => ({
      enqueueNotify: (
        request: NotifyRequest,
      ): Effect.Effect<void, never, never> =>
        pipe(
          Queue.offer(queue, { _tag: "notify", request }),
          Effect.asVoid,
          Observable.withSpan(request.signal, "SignalService.enqueueNotify", {
            captureStackTrace: true,
          }),
        ),
      _enqueueRunTracked: <A, E>(
        request: RunTrackedRequest<A, E>,
      ): Effect.Effect<A, E, never> =>
        pipe(
          workerFiberRef,
          FiberRef.get,
          Effect.flatMap((isWorkerFiber) =>
            isWorkerFiber
              ? runAndTrackEffect(request.effect)(request.ctx)
              : pipe(
                  Deferred.make<A, E>(),
                  Effect.tap((deferred) =>
                    Queue.offer(queue, {
                      _tag: "runTracked",
                      deferred: deferred as Deferred.Deferred<unknown, unknown>,
                      request,
                    }),
                  ),
                  Effect.flatMap((deferred) => Deferred.await(deferred)),
                ),
          ),
          Observable.withSpan(
            request.ctx.signal,
            "SignalService.enqueueRunTracked",
            {
              captureStackTrace: true,
            },
          ),
        ),
    })),
  ),
  accessors: true,
  dependencies: [],
};

const BaseSignalServiceClass: Effect.Service.Class<
  SignalService,
  "SignalService",
  typeof signalServiceDefinition
> = Effect.Service<SignalService>()("SignalService", signalServiceDefinition);
export class SignalService extends BaseSignalServiceClass {
  static enqueueRunTracked = <A, E>(request: RunTrackedRequest<A, E>) =>
    SignalService.use((service) => service._enqueueRunTracked(request));
}
