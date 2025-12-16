import { Effect, pipe, Queue, Scope } from "effect";
import { Observable } from "../observability";
import { DependencySignal, notifyAllDependents } from "./dependencySignal";

type EnqueueRequest = {
  readonly signal: DependencySignal<unknown, unknown, unknown>;
  readonly beforeNotify: (
    watched: boolean,
  ) => Effect.Effect<void, never, never>;
};

type SignalServiceInterface = {
  enqueue: (request: EnqueueRequest) => Effect.Effect<void, never, never>;
};

const signalServiceDefinition: {
  scoped: Effect.Effect<SignalServiceInterface, never, Scope.Scope>;
  accessors: true;
  dependencies: [];
} = {
  scoped: pipe(
    Queue.unbounded<EnqueueRequest>(),
    Effect.tap((queue) =>
      pipe(
        Queue.take(queue),
        Effect.flatMap(({ signal, beforeNotify }) =>
          notifyAllDependents(beforeNotify)(signal),
        ),
        Effect.forever,
        Effect.withSpan("SignalService.worker", {
          captureStackTrace: true,
        }),
        Effect.forkScoped,
      ),
    ),
    Effect.map((queue) => ({
      enqueue: (request: EnqueueRequest): Effect.Effect<void, never, never> =>
        pipe(
          Queue.offer(queue, request),
          Effect.asVoid,
          Observable.withSpan(request.signal, "SignalService.enqueue", {
            captureStackTrace: true,
          }),
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
export class SignalService extends BaseSignalServiceClass {}
