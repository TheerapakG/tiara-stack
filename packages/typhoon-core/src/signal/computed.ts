import {
  Context,
  Effect,
  Effectable,
  Equal,
  Function,
  Exit,
  Option,
  TRef,
  TQueue,
  TSet,
  STM,
  pipe,
  Types,
} from "effect";
import { Observable } from "../observability";
import { DependencySignal, DependencySymbol } from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import * as SignalService from "./signalService";

export class Computed<A = never, E = never, R = never>
  extends Effectable.Class<A, E, R | SignalService.SignalService>
  implements DependentSignal, DependencySignal<A, E, R>
{
  readonly _tag = "Computed" as const;
  readonly [DependencySymbol]: DependencySignal<A, E, R> = this;
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: Effect.Effect<A, E, R | SignalService.SignalService>;
  private _dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>;
  private _dependencies: TSet.TSet<DependencySignal<unknown, unknown, unknown>>;
  private _reference: WeakRef<Computed<A, E, R>>;
  private _queue: TQueue.TQueue<Exit.Exit<A, E>>;
  private _lastExit: TRef.TRef<Option.Option<Exit.Exit<A, E>>>;

  constructor(
    effect: Effect.Effect<A, E, R | SignalService.SignalService>,
    dependents: TSet.TSet<WeakRef<DependentSignal> | DependentSignal>,
    dependencies: TSet.TSet<DependencySignal<unknown, unknown, unknown>>,
    queue: TQueue.TQueue<Exit.Exit<A, E>>,
    lastExit: TRef.TRef<Option.Option<Exit.Exit<A, E>>>,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._effect = effect;
    this._dependents = dependents;
    this._dependencies = dependencies;
    this._reference = new WeakRef(this);
    this._queue = queue;
    this._lastExit = lastExit;
    this[Observable.ObservableSymbol] = options;
  }

  addDependent(dependent: WeakRef<DependentSignal> | DependentSignal) {
    return TSet.add(this._dependents, dependent);
  }

  removeDependent(dependent: WeakRef<DependentSignal> | DependentSignal) {
    return TSet.remove(this._dependents, dependent);
  }

  clearDependents() {
    return pipe(
      TSet.forEach(this._dependents, (dependent) =>
        dependent instanceof WeakRef
          ? (dependent.deref()?.removeDependency(this) ?? STM.void)
          : dependent.removeDependency(this),
      ),
      STM.zipRight(TSet.removeIf(this._dependents, () => true)),
    );
  }

  addDependency(dependency: DependencySignal<unknown, unknown, unknown>) {
    return TSet.add(this._dependencies, dependency);
  }

  removeDependency(dependency: DependencySignal<unknown, unknown, unknown>) {
    return TSet.remove(this._dependencies, dependency);
  }

  clearDependencies() {
    return pipe(
      TSet.forEach(this._dependencies, (dependency) => dependency.removeDependent(this)),
      STM.zipRight(TSet.removeIf(this._dependencies, () => true)),
    );
  }

  getDependencies(): STM.STM<TSet.TSet<DependencySignal<unknown, unknown, unknown>>, never, never> {
    return STM.succeed(this._dependencies);
  }

  getDependents(): STM.STM<TSet.TSet<WeakRef<DependentSignal> | DependentSignal>, never, never> {
    return STM.succeed(this._dependents);
  }

  value(): Effect.Effect<A, E, R | SignalService.SignalService> {
    return pipe(
      SignalService.bindDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "Computed.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<A, E, R | SignalService.SignalService> {
    return this.value();
  }

  peek(): Effect.Effect<A, E, R | SignalService.SignalService> {
    return pipe(
      STM.all({
        queue: TQueue.peekOption(this._queue),
        context: pipe(STM.context<R>(), STM.map(Context.omit(SignalService.SignalService))),
      }),
      STM.commit,
      Effect.flatMap(({ queue, context }) =>
        pipe(
          queue,
          Option.match({
            onSome: Function.identity,
            onNone: () =>
              pipe(SignalService.enqueueRunTracked(this._makeRunTrackedRequest(context))),
          }),
        ),
      ),
      Observable.withSpan(this, "Computed.peek", {
        captureStackTrace: true,
      }),
    );
  }

  reset(): STM.STM<void, never, never> {
    return pipe(TQueue.takeAll(this._queue), STM.asVoid);
  }

  getReferenceForDependency(): STM.STM<WeakRef<DependentSignal> | DependentSignal, never, never> {
    return STM.succeed(this._reference);
  }

  notify(): Effect.Effect<unknown, never, SignalService.SignalService> {
    return pipe(
      this.clearDependencies(),
      STM.zipRight(this.reset()),
      STM.commit,
      Observable.withSpan(this, "Computed.notify", {
        captureStackTrace: true,
      }),
    );
  }

  recompute(): Effect.Effect<void, never, SignalService.SignalService> {
    return pipe(
      SignalService.enqueueNotify(
        new SignalService.NotifyRequest({
          beforeNotify: () => pipe(this.reset(), STM.commit),
          signal: this,
        }),
      ),
      Effect.asVoid,
      Observable.withSpan(this, "Computed.recompute", {
        captureStackTrace: true,
      }),
    );
  }

  reconcile(): STM.STM<void, never, never> {
    return STM.void;
  }

  private _makeRunTrackedRequest(
    context: Context.Context<Exclude<R, SignalService.SignalService>>,
  ) {
    return new SignalService.RunTrackedRequest({
      effect: pipe(
        this._effect,
        Effect.exit,
        Effect.tap((exit) =>
          pipe(
            TQueue.offer(this._queue, exit),
            STM.zipRight(TRef.getAndSet(this._lastExit, Option.some(exit))),
            STM.commit,
            Effect.flatMap((lastExit) =>
              Effect.when(() => Equal.equals(lastExit, Option.some(exit)))(
                SignalService.markUnchanged(this),
              ),
            ),
          ),
        ),
        Effect.flatten,
        Effect.provide(context),
      ) as Effect.Effect<A, E, SignalService.SignalService>,
      signal: this,
    });
  }
}

export type Success<S extends Computed<unknown, unknown, unknown>> = Effect.Effect.Success<
  ReturnType<S["peek"]>
>;

export type Error<S extends Computed<unknown, unknown, unknown>> = Effect.Effect.Error<
  ReturnType<S["peek"]>
>;

export type Context<S extends Computed<unknown, unknown, unknown>> = Effect.Effect.Context<
  ReturnType<S["peek"]>
>;

export const makeSTM = <A = never, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    STM.all({
      dependents: TSet.empty<WeakRef<DependentSignal> | DependentSignal>(),
      dependencies: TSet.empty<DependencySignal<unknown, unknown, unknown>>(),
      queue: TQueue.sliding<Exit.Exit<A, E>>(1),
      lastExit: TRef.make(Option.none<Exit.Exit<A, E>>()),
    }),
    STM.map(
      ({ dependents, dependencies, queue, lastExit }) =>
        new Computed<A, E, Exclude<R, SignalService.SignalService>>(
          effect as Effect.Effect<A, E, Exclude<R, SignalService.SignalService>>,
          dependents,
          dependencies,
          queue,
          lastExit,
          options ?? {},
        ),
    ),
  );

export const make = <A = never, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    makeSTM(effect, options),
    STM.commit,
    Observable.withSpan(
      {
        _tag: "Computed" as const,
        [Observable.ObservableSymbol]: options ?? {},
      },
      "Computed.make",
      {
        captureStackTrace: true,
      },
    ),
  );

export const makeAll = <
  const Arg extends
    | Iterable<Effect.Effect<any, any, any>>
    | Record<string, Effect.Effect<any, any, any>>,
  O extends Types.NoExcessProperties<
    {
      readonly concurrency?: Types.Concurrency | undefined;
      readonly batching?: boolean | "inherit" | undefined;
      readonly discard?: boolean | undefined;
      readonly mode?: "default" | "validate" | "either" | undefined;
      readonly concurrentFinalizers?: boolean | undefined;
    },
    O
  >,
>(
  arg: Arg,
  allOptions?: O,
  options?: Observable.ObservableOptions,
) =>
  make(
    Effect.all(arg, allOptions) as unknown as Effect.Effect<
      Effect.Effect.Success<Effect.All.Return<Arg, O>>,
      Effect.Effect.Error<Effect.All.Return<Arg, O>>,
      Effect.Effect.Context<Effect.All.Return<Arg, O>>
    >,
    options,
  );

export const all = <
  const Arg extends
    | Iterable<Effect.Effect<any, any, any>>
    | Record<string, Effect.Effect<any, any, any>>,
  O extends Types.NoExcessProperties<
    {
      readonly concurrency?: Types.Concurrency | undefined;
      readonly batching?: boolean | "inherit" | undefined;
      readonly discard?: boolean | undefined;
      readonly mode?: "default" | "validate" | "either" | undefined;
      readonly concurrentFinalizers?: boolean | undefined;
    },
    O
  >,
  E = never,
  R = never,
>(
  arg: Effect.Effect<Arg, E, R>,
  allOptions?: O,
  options?: Observable.ObservableOptions,
) => Effect.flatMap(arg, (arg) => makeAll(arg, allOptions, options));

export const makeAllWith =
  <
    O extends Types.NoExcessProperties<
      {
        readonly concurrency?: Types.Concurrency | undefined;
        readonly batching?: boolean | "inherit" | undefined;
        readonly discard?: boolean | undefined;
        readonly mode?: "default" | "validate" | "either" | undefined;
        readonly concurrentFinalizers?: boolean | undefined;
      },
      O
    >,
  >(
    allOptions?: O,
    options?: Observable.ObservableOptions,
  ) =>
  <
    const Arg extends
      | Iterable<DependencySignal<any, any, any>>
      | Record<string, DependencySignal<any, any, any>>,
  >(
    arg: Arg,
  ) =>
    makeAll(arg, allOptions, options);

export const allWith =
  <
    O extends Types.NoExcessProperties<
      {
        readonly concurrency?: Types.Concurrency | undefined;
        readonly batching?: boolean | "inherit" | undefined;
        readonly discard?: boolean | undefined;
        readonly mode?: "default" | "validate" | "either" | undefined;
        readonly concurrentFinalizers?: boolean | undefined;
      },
      O
    >,
  >(
    allOptions?: O,
    options?: Observable.ObservableOptions,
  ) =>
  <
    const Arg extends
      | Iterable<Effect.Effect<any, any, any>>
      | Record<string, Effect.Effect<any, any, any>>,
    E = never,
    R = never,
  >(
    arg: Effect.Effect<Arg, E, R>,
  ) =>
    all(arg, allOptions, options);
