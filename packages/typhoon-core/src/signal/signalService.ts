import {
  Array,
  Context,
  Data,
  Deferred,
  Effect,
  FiberRef,
  HashSet,
  Layer,
  Match,
  Number,
  Option,
  pipe,
  TQueue,
  STM,
  TMap,
  TRef,
  TSet,
} from "effect";
import { Observable } from "../observability";
import { DependencySignal, isDependencySignal } from "./dependencySignal";
import { DependentSignal, isDependentSignal, reconcileAllDependencies } from "./dependentSignal";

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
  readonly request: NotifyRequest;
  readonly service: Context.Tag.Service<SignalService>;
}> {}

type RunTrackedRequestData<A, E> = {
  readonly effect: Effect.Effect<A, E, SignalService>;
  readonly signal: DependentSignal;
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
  readonly service: Context.Tag.Service<SignalService>;
}> {}

type WorkItem = NotifyWorkItem | RunTrackedWorkItem;

type SignalServiceShape = {
  readonly bindDependency: (
    dependency: DependencySignal<unknown, unknown, unknown>,
  ) => Effect.Effect<void, never, never>;
  readonly markUnchanged: (
    signal: DependencySignal<unknown, unknown, unknown>,
  ) => Effect.Effect<void, never, never>;
  readonly enqueueNotify: (request: NotifyRequest) => Effect.Effect<void, never, SignalService>;
  readonly enqueueRunTracked: <A, E>(
    request: RunTrackedRequest<A, E>,
  ) => Effect.Effect<A, E, SignalService>;
};
const SignalServiceTag: Context.TagClass<SignalService, "SignalService", SignalServiceShape> =
  Context.Tag("SignalService")<SignalService, SignalServiceShape>();
export class SignalService extends SignalServiceTag {}

const buildDependentsSnapshot = (
  dependency: DependencySignal<unknown, unknown, unknown> | DependentSignal,
): STM.STM<
  TMap.TMap<
    DependencySignal<unknown, unknown, unknown> | DependentSignal,
    {
      dependencies: DependencySignal<unknown, unknown, unknown>[];
      dependents: DependentSignal[];
    }
  >,
  never,
  never
> =>
  pipe(
    STM.Do,
    STM.bind("dependencies", () =>
      isDependentSignal(dependency)
        ? pipe(dependency.getDependencies(), STM.flatMap(TSet.toArray))
        : STM.succeed([]),
    ),
    STM.bind("dependents", () =>
      isDependencySignal(dependency)
        ? pipe(dependency.getDependents(), STM.flatMap(TSet.toArray))
        : STM.succeed([]),
    ),
    STM.let("derefDependents", ({ dependents }) =>
      pipe(
        dependents,
        Array.map((dependent) => (dependent instanceof WeakRef ? dependent.deref() : dependent)),
        Array.filter((dependent) => dependent !== undefined),
      ),
    ),
    STM.bind("dependentsMap", ({ dependencies, derefDependents }) =>
      TMap.make([dependency, { dependencies, dependents: derefDependents }]),
    ),
    STM.tap(({ derefDependents, dependentsMap }) =>
      STM.forEach(derefDependents, (dependent) =>
        pipe(
          buildDependentsSnapshot(dependent),
          STM.flatMap(TMap.toArray),
          STM.flatMap(STM.forEach(([key, value]) => TMap.setIfAbsent(dependentsMap, key, value))),
        ),
      ),
    ),
    STM.map(({ dependentsMap }) => dependentsMap),
  );

const getDependentsUpdateOrder = (
  dependentsSnapshot: TMap.TMap<
    DependencySignal<unknown, unknown, unknown> | DependentSignal,
    {
      dependencies: DependencySignal<unknown, unknown, unknown>[];
      dependents: DependentSignal[];
    }
  >,
  dependency: DependencySignal<unknown, unknown, unknown>,
): STM.STM<DependentSignal[], never, never> =>
  pipe(
    STM.Do,
    STM.bind("thisDependents", () =>
      pipe(
        TMap.get(dependentsSnapshot, dependency),
        STM.map(Option.map(({ dependents }) => dependents)),
        STM.map(Option.getOrElse(() => [] as DependentSignal[])),
      ),
    ),
    STM.bind("nestedDependents", ({ thisDependents }) =>
      pipe(
        STM.all(
          pipe(
            thisDependents,
            Array.filter((dependency) => isDependencySignal(dependency)),
            Array.map((dependency) => getDependentsUpdateOrder(dependentsSnapshot, dependency)),
          ),
        ),
        STM.map(Array.flatten),
      ),
    ),
    STM.let("dependents", ({ thisDependents, nestedDependents }) =>
      Array.appendAll(thisDependents, nestedDependents),
    ),
    STM.map(({ dependents }) => {
      const seen = new Set();
      return dependents
        .reverse()
        .filter((item) => {
          if (seen.has(item)) return false;
          seen.add(item);
          return true;
        })
        .reverse();
    }),
  );

const computeChanged = (
  changed: TSet.TSet<DependencySignal<unknown, unknown, unknown>>,
  currentUnchanged: TRef.TRef<
    Option.Option<TSet.TSet<DependencySignal<unknown, unknown, unknown>>>
  >,
  dependentsSnapshot: TMap.TMap<
    DependencySignal<unknown, unknown, unknown> | DependentSignal,
    {
      dependencies: DependencySignal<unknown, unknown, unknown>[];
      dependents: DependentSignal[];
    }
  >,
  dependent: DependentSignal,
) =>
  pipe(
    TSet.toHashSet(changed),
    STM.flatMap((changed) =>
      pipe(
        TRef.get(currentUnchanged),
        STM.flatMap(
          Option.match({
            onSome: (unchanged) => STM.succeed(unchanged),
            onNone: () => TSet.empty<DependencySignal<unknown, unknown, unknown>>(),
          }),
        ),
        STM.flatMap(TSet.toHashSet),
        STM.map((unchanged) => HashSet.difference(changed, unchanged)),
      ),
    ),
    STM.flatMap((changed) =>
      pipe(
        TMap.get(dependentsSnapshot, dependent),
        STM.map(
          Option.match({
            onSome: ({ dependencies }) => dependencies,
            onNone: () => [],
          }),
        ),
        STM.map(HashSet.fromIterable),
        STM.map((dependencies) => HashSet.intersection(dependencies, changed)),
      ),
    ),
  );

export const notifyAllDependents = (
  beforeNotify: (watched: boolean) => Effect.Effect<void, never, never>,
  signal: DependencySignal<unknown, unknown, unknown>,
  currentUnchanged: TRef.TRef<
    Option.Option<TSet.TSet<DependencySignal<unknown, unknown, unknown>>>
  >,
) =>
  pipe(
    STM.all({
      dependentsSnapshot: buildDependentsSnapshot(signal),
      changed: TSet.make(signal),
    }),
    STM.bind("dependents", ({ dependentsSnapshot }) =>
      getDependentsUpdateOrder(dependentsSnapshot, signal),
    ),
    STM.let("watched", ({ dependents }) =>
      dependents.some((dependent) => !isDependencySignal(dependent)),
    ),
    STM.tap(() => signal.clearDependents()),
    STM.commit,
    Effect.tap(({ watched }) => beforeNotify(watched)),
    Effect.andThen(({ dependentsSnapshot, dependents, changed }) =>
      Effect.forEach(
        dependents,
        (dependent) =>
          pipe(
            computeChanged(changed, currentUnchanged, dependentsSnapshot, dependent),
            STM.map(HashSet.size),
            STM.map((size) => !Number.Equivalence(size, 0)),
            STM.tap(() =>
              isDependencySignal(dependent) ? TSet.add(changed, dependent) : STM.void,
            ),
            STM.commit,
            Effect.tap((changed) =>
              changed
                ? dependent.notify()
                : isDependencySignal(dependent)
                  ? pipe(
                      TRef.get(currentUnchanged),
                      STM.flatMap(
                        Option.match({
                          onSome: (unchanged) => TSet.add(unchanged, dependent),
                          onNone: () => STM.void,
                        }),
                      ),
                      STM.commit,
                    )
                  : Effect.void,
            ),
          ),
        { discard: true },
      ),
    ),
    Observable.withSpan(signal, "DependencySignal.notifyAllDependents", {
      captureStackTrace: true,
    }),
  );

const runAndTrackEffect = <A, E, R>(effect: Effect.Effect<A, E, R>, signal: DependentSignal) =>
  pipe(
    effect,
    Effect.tap(() => pipe(reconcileAllDependencies(signal), STM.commit)),
  );

export const layer: Layer.Layer<SignalService, never, never> = pipe(
  Effect.all({
    queue: TQueue.unbounded<WorkItem>(),
    currentSignal: TRef.make(Option.none<DependentSignal>()),
    currentUnchanged: TRef.make(
      Option.none<TSet.TSet<DependencySignal<unknown, unknown, unknown>>>(),
    ),
    workerFiberRef: FiberRef.make(false),
  }),
  Effect.tap(({ queue, currentSignal, currentUnchanged, workerFiberRef }) =>
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
                  Effect.acquireUseRelease(
                    pipe(
                      TSet.empty<DependencySignal<unknown, unknown, unknown>>(),
                      STM.flatMap((set) => TRef.getAndSet(currentUnchanged, Option.some(set))),
                      STM.commit,
                    ),
                    () =>
                      pipe(
                        notifyAllDependents(request.beforeNotify, request.signal, currentUnchanged),
                        Effect.provideService(SignalService, service),
                      ),
                    (previousSet) => pipe(TRef.set(currentUnchanged, previousSet), STM.commit),
                  ),
                  Effect.catchAllCause((cause) => Effect.logError(cause)),
                ),
              RunTrackedWorkItem: ({ deferred, request, service }) =>
                pipe(
                  Effect.acquireUseRelease(
                    pipe(TRef.getAndSet(currentSignal, Option.some(request.signal)), STM.commit),
                    () =>
                      pipe(
                        runAndTrackEffect(request.effect, request.signal),
                        Effect.provideService(SignalService, service),
                        Effect.intoDeferred(deferred),
                      ),
                    (previousSignal) => pipe(TRef.set(currentSignal, previousSignal), STM.commit),
                  ),
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
  Effect.map(({ queue, currentSignal, currentUnchanged, workerFiberRef }) => ({
    bindDependency: (dependency: DependencySignal<unknown, unknown, unknown>) =>
      pipe(
        FiberRef.get(workerFiberRef),
        Effect.flatMap((isWorkerFiber) =>
          isWorkerFiber
            ? pipe(
                TRef.get(currentSignal),
                STM.flatMap(
                  Option.match({
                    onSome: (signal) =>
                      STM.all([
                        pipe(
                          signal.getReferenceForDependency(),
                          STM.flatMap((reference) => dependency.addDependent(reference)),
                        ),
                        signal.addDependency(dependency),
                      ]),
                    onNone: () => STM.void,
                  }),
                ),
                STM.commit,
              )
            : Effect.void,
        ),
        Effect.asVoid,
      ),
    markUnchanged: (signal: DependencySignal<unknown, unknown, unknown>) =>
      pipe(
        FiberRef.get(workerFiberRef),
        Effect.flatMap((isWorkerFiber) =>
          isWorkerFiber
            ? pipe(
                TRef.get(currentUnchanged),
                STM.flatMap(
                  Option.match({
                    onSome: (unchanged) => TSet.add(unchanged, signal),
                    onNone: () => STM.void,
                  }),
                ),
                STM.commit,
              )
            : Effect.void,
        ),
        Effect.asVoid,
      ),
    enqueueNotify: (request: NotifyRequest) =>
      pipe(
        Effect.all({
          isWorkerFiber: FiberRef.get(workerFiberRef),
          service: SignalService,
        }),
        Effect.flatMap(({ isWorkerFiber, service }) =>
          isWorkerFiber
            ? Effect.acquireUseRelease(
                pipe(
                  TSet.empty<DependencySignal<unknown, unknown, unknown>>(),
                  STM.flatMap((set) => TRef.getAndSet(currentUnchanged, Option.some(set))),
                  STM.commit,
                ),
                () => notifyAllDependents(request.beforeNotify, request.signal, currentUnchanged),
                (previousSet) => pipe(TRef.set(currentUnchanged, previousSet), STM.commit),
              )
            : TQueue.offer(queue, new NotifyWorkItem({ request, service })),
        ),
        Effect.asVoid,
      ),
    enqueueRunTracked: <A, E>(request: RunTrackedRequest<A, E>) =>
      pipe(
        Effect.all({
          isWorkerFiber: FiberRef.get(workerFiberRef),
          service: SignalService,
        }),
        Effect.flatMap(({ isWorkerFiber, service }) =>
          isWorkerFiber
            ? Effect.acquireUseRelease(
                pipe(TRef.getAndSet(currentSignal, Option.some(request.signal)), STM.commit),
                () => runAndTrackEffect(request.effect, request.signal),
                (previousSignal) => pipe(TRef.set(currentSignal, previousSignal), STM.commit),
              )
            : pipe(
                Deferred.make<A, E>(),
                Effect.tap((deferred) =>
                  TQueue.offer(
                    queue,
                    new RunTrackedWorkItem({
                      deferred: deferred as Deferred.Deferred<unknown, unknown>,
                      request,
                      service,
                    }),
                  ),
                ),
                Effect.flatMap((deferred) => Deferred.await(deferred)),
              ),
        ),
        Observable.withSpan(request.signal, "SignalService.enqueueRunTracked", {
          captureStackTrace: true,
        }),
      ),
  })),
  Layer.scoped(SignalService),
);

export const markUnchanged = (
  signal: DependencySignal<unknown, unknown, unknown>,
): Effect.Effect<void, never, SignalService> =>
  pipe(
    SignalService,
    Effect.flatMap((service) => service.markUnchanged(signal)),
  );

export const bindDependency = (
  dependency: DependencySignal<unknown, unknown, unknown>,
): Effect.Effect<void, never, SignalService> =>
  pipe(
    SignalService,
    Effect.flatMap((service) => service.bindDependency(dependency)),
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

export type MaybeSignalEffect<A = never, E = never, R = never> =
  | A
  | Effect.Effect<A, E, R | SignalService>;

export type MaybeSignalEffectValue<X> =
  X extends Effect.Effect<any, any, any>
    ? Effect.Effect.AsEffect<X>
    : Effect.Effect<X, never, never>;

export const getMaybeSignalEffectValue = <X>(value: X): MaybeSignalEffectValue<X> =>
  (Effect.isEffect(value) ? value : Effect.succeed(value)) as MaybeSignalEffectValue<X>;
