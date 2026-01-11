import {
  Context,
  Data,
  Deferred,
  Effect,
  FiberRef,
  Layer,
  Match,
  Option,
  pipe,
  TQueue,
  STM,
} from "effect";
import { Observable } from "../observability";
import { DependencySignal, notifyAllDependents } from "./dependencySignal";
import * as SignalContext from "./signalContext";

type NotifyRequestData = {
  readonly signal: DependencySignal<unknown, unknown, unknown>;
  readonly beforeNotify: (watched: boolean) => Effect.Effect<void, never, never>;
};
const NotifyRequestTaggedClass: new (
  args: Readonly<NotifyRequestData>,
) => Readonly<NotifyRequestData> & { readonly _tag: "NotifyRequest" } =
  Data.TaggedClass("NotifyRequest");
export class NotifyRequest extends NotifyRequestTaggedClass {}

class NotifyWorkItem extends Data.TaggedClass("NotifyWorkItem")<{
  readonly service: Context.Tag.Service<SignalService>;
  readonly request: NotifyRequest;
}> {}

type RunTrackedRequestData<A, E> = {
  readonly effect: Effect.Effect<A, E, SignalContext.SignalContext>;
  readonly ctx: Context.Tag.Service<SignalContext.SignalContext>;
};
const RunTrackedRequestTaggedClass: new <A, E>(
  args: Readonly<RunTrackedRequestData<A, E>>,
) => Readonly<RunTrackedRequestData<A, E>> & {
  readonly _tag: "RunTrackedRequest";
} = Data.TaggedClass("RunTrackedRequest");
export class RunTrackedRequest<A, E> extends RunTrackedRequestTaggedClass<A, E> {}

class RunTrackedWorkItem extends Data.TaggedClass("RunTrackedWorkItem")<{
  readonly deferred: Deferred.Deferred<unknown, unknown>;
  readonly request: RunTrackedRequest<unknown, unknown>;
}> {}

type WorkItem = NotifyWorkItem | RunTrackedWorkItem;

type SignalServiceShape = {
  readonly enqueueNotify: (request: NotifyRequest) => Effect.Effect<void, never, SignalService>;
  readonly enqueueRunTracked: <A, E>(
    request: RunTrackedRequest<A, E>,
  ) => Effect.Effect<A, E, SignalService>;
};
const SignalServiceTag: Context.TagClass<SignalService, "SignalService", SignalServiceShape> =
  Context.Tag("SignalService")<SignalService, SignalServiceShape>();
export class SignalService extends SignalServiceTag {}

export const layer: Layer.Layer<SignalService, never, never> = pipe(
  Effect.all({
    queue: TQueue.unbounded<WorkItem>(),
    workerFiberRef: FiberRef.make(false),
  }),
  Effect.tap(({ queue, workerFiberRef }) =>
    pipe(
      TQueue.take(queue),
      STM.commit,
      Effect.flatMap((item) =>
        Effect.locally(
          workerFiberRef,
          true,
        )(
          pipe(
            Match.value(item),
            Match.tagsExhaustive({
              NotifyWorkItem: ({ request, service }) =>
                pipe(
                  notifyAllDependents(request.beforeNotify)(request.signal),
                  Effect.provideService(SignalService, service),
                  Effect.catchAllCause((cause) => Effect.logError(cause)),
                ),
              RunTrackedWorkItem: ({ deferred, request }) =>
                pipe(
                  SignalContext.runAndTrackEffect(request.effect)(request.ctx),
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
    enqueueNotify: (request: NotifyRequest) =>
      pipe(
        Effect.all({
          isWorkerFiber: FiberRef.get(workerFiberRef),
          service: SignalService,
        }),
        Effect.flatMap(({ isWorkerFiber, service }) =>
          isWorkerFiber
            ? notifyAllDependents(request.beforeNotify)(request.signal)
            : TQueue.offer(queue, new NotifyWorkItem({ request, service })),
        ),
        Effect.asVoid,
      ),
    enqueueRunTracked: <A, E>(request: RunTrackedRequest<A, E>) =>
      pipe(
        FiberRef.get(workerFiberRef),
        Effect.flatMap((isWorkerFiber) =>
          isWorkerFiber
            ? SignalContext.runAndTrackEffect(request.effect)(request.ctx)
            : pipe(
                Deferred.make<A, E>(),
                Effect.tap((deferred) =>
                  TQueue.offer(
                    queue,
                    new RunTrackedWorkItem({
                      deferred: deferred as Deferred.Deferred<unknown, unknown>,
                      request,
                    }),
                  ),
                ),
                Effect.flatMap((deferred) => Deferred.await(deferred)),
              ),
        ),
        Observable.withSpan(
          Option.getOrElse(request.ctx.signal, () => ({
            _tag: "UnknownSignal" as const,
            [Observable.ObservableSymbol]: {},
          })),
          "SignalService.enqueueRunTracked",
          {
            captureStackTrace: true,
          },
        ),
      ),
  })),
  Layer.scoped(SignalService),
);

export const enqueueNotify = (request: NotifyRequest): Effect.Effect<void, never, SignalService> =>
  pipe(
    SignalService,
    Effect.flatMap((service) => service.enqueueNotify(request)),
  );

export const enqueueRunTracked = <A, E>(
  request: RunTrackedRequest<A, E>,
): Effect.Effect<A, E, SignalService> =>
  pipe(
    SignalService,
    Effect.flatMap((service) => service.enqueueRunTracked(request)),
  );
