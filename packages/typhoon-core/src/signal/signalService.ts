import { Effect, pipe, Queue } from "effect";
import { Observable } from "../observability";
import { DependencySignal, notifyAllDependents } from "./dependencySignal";

type EnqueueRequest = {
  readonly signal: DependencySignal<unknown, unknown, unknown>;
  readonly beforeNotify: (
    watched: boolean,
  ) => Effect.Effect<void, never, never>;
};

export interface Service {
  enqueue: (request: EnqueueRequest) => Effect.Effect<void, never, never>;
}

const make = pipe(
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
      Effect.forkDaemon,
    ),
  ),
  Effect.map(
    (queue): Service => ({
      enqueue: (request: EnqueueRequest): Effect.Effect<void, never, never> =>
        pipe(
          Queue.offer(queue, request),
          Effect.asVoid,
          Observable.withSpan(request.signal, "SignalService.enqueue", {
            captureStackTrace: true,
          }),
        ),
    }),
  ),
);

export class SignalService extends Effect.Service<Service>()("SignalService", {
  effect: make,
  accessors: true,
  dependencies: [],
}) {}

export const enqueue = (request: EnqueueRequest) =>
  pipe(
    SignalService,
    Effect.flatMap((service) => service.enqueue(request)),
  );
