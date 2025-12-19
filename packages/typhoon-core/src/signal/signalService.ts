import {
  Context,
  Data,
  Deferred,
  Effect,
  FiberRef,
  Match,
  pipe,
  Queue,
  Scope,
} from "effect";
import { Observable } from "../observability";
import { DependencySignal, notifyAllDependents } from "./dependencySignal";
import { SignalContext, runAndTrackEffect } from "./signalContext";

type NotifyRequestData = {
  readonly signal: DependencySignal<unknown, unknown, unknown>;
  readonly beforeNotify: (
    watched: boolean,
  ) => Effect.Effect<void, never, never>;
};
const NotifyRequestTaggedClass: new (
  args: Readonly<NotifyRequestData>,
) => Readonly<NotifyRequestData> & { readonly _tag: "NotifyRequest" } =
  Data.TaggedClass("NotifyRequest");
export class NotifyRequest extends NotifyRequestTaggedClass {}

class NotifyWorkItem extends Data.TaggedClass("NotifyWorkItem")<{
  readonly request: NotifyRequest;
}> {}

type RunTrackedRequestData<A, E> = {
  readonly effect: Effect.Effect<A, E, SignalContext>;
  readonly ctx: Context.Tag.Service<SignalContext>;
};
const RunTrackedRequestTaggedClass: new <A, E>(
  args: Readonly<RunTrackedRequestData<A, E>>,
) => Readonly<RunTrackedRequestData<A, E>> & {
  readonly _tag: "RunTrackedRequest";
} = Data.TaggedClass("RunTrackedRequest");
export class RunTrackedRequest<A, E> extends RunTrackedRequestTaggedClass<
  A,
  E
> {}

class RunTrackedWorkItem extends Data.TaggedClass("RunTrackedWorkItem")<{
  readonly deferred: Deferred.Deferred<unknown, unknown>;
  readonly request: RunTrackedRequest<unknown, unknown>;
}> {}

type WorkItem = NotifyWorkItem | RunTrackedWorkItem;

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
            pipe(
              Match.value(item),
              Match.tagsExhaustive({
                NotifyWorkItem: ({ request }) =>
                  pipe(
                    notifyAllDependents(request.beforeNotify)(request.signal),
                    Effect.catchAllCause((cause) => Effect.logError(cause)),
                  ),
                RunTrackedWorkItem: ({ deferred, request }) =>
                  pipe(
                    runAndTrackEffect(request.effect)(request.ctx),
                    Effect.intoDeferred(deferred),
                    Effect.catchAllCause((cause) => Effect.logError(cause)),
                  ),
              }),
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
          Queue.offer(queue, new NotifyWorkItem({ request })),
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
                    Queue.offer(
                      queue,
                      new RunTrackedWorkItem({
                        deferred: deferred as Deferred.Deferred<
                          unknown,
                          unknown
                        >,
                        request,
                      }),
                    ),
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
