import {
  Effect,
  Effectable,
  Exit,
  HashSet,
  Option,
  TQueue,
  TSemaphore,
  STM,
  pipe,
  Types,
} from "effect";
import { Observable } from "../observability";
import {
  DependencySignal,
  DependencySymbol,
  notifyAllDependents,
} from "./dependencySignal";
import { DependentSignal, DependentSymbol } from "./dependentSignal";
import {
  bindScopeDependency,
  fromDependent,
  runAndTrackEffect,
  SignalContext,
} from "./signalContext";
import * as SignalService from "./signalService";

export class Computed<A = never, E = never, R = never>
  extends Effectable.Class<
    A,
    E,
    R | SignalContext | SignalService.SignalService
  >
  implements DependentSignal, DependencySignal<A, E, R>
{
  readonly [DependencySymbol]: DependencySignal<A, E, R> = this;
  readonly [DependentSymbol]: DependentSignal = this;
  readonly [Observable.ObservableSymbol]: Observable.ObservableOptions;

  private _effect: Effect.Effect<A, E, R | SignalContext>;
  private _dependents: HashSet.HashSet<
    WeakRef<DependentSignal> | DependentSignal
  >;
  private _dependencies: HashSet.HashSet<DependencySignal>;
  private _reference: WeakRef<Computed<A, E, R>>;
  private _queue: TQueue.TQueue<Exit.Exit<A, E>>;
  private _semaphore: TSemaphore.TSemaphore;

  constructor(
    effect: Effect.Effect<A, E, R | SignalContext>,
    queue: TQueue.TQueue<Exit.Exit<A, E>>,
    semaphore: TSemaphore.TSemaphore,
    options: Observable.ObservableOptions,
  ) {
    super();
    this._effect = effect;
    this._dependents = HashSet.empty();
    this._dependencies = HashSet.empty();
    this._reference = new WeakRef(this);
    this._queue = queue;
    this._semaphore = semaphore;
    this[Observable.ObservableSymbol] = options;
  }

  addDependent(dependent: WeakRef<DependentSignal> | DependentSignal) {
    return Effect.sync(() => {
      this._dependents = HashSet.add(this._dependents, dependent);
    });
  }

  removeDependent(dependent: WeakRef<DependentSignal> | DependentSignal) {
    return Effect.sync(() => {
      this._dependents = HashSet.remove(this._dependents, dependent);
    });
  }

  clearDependents() {
    return Effect.sync(() => {
      HashSet.forEach(this._dependents, (dependent) =>
        dependent instanceof WeakRef
          ? dependent.deref()?.removeDependency(this)
          : dependent.removeDependency(this),
      );
      this._dependents = HashSet.empty();
    });
  }

  addDependency(dependency: DependencySignal) {
    return Effect.sync(() => {
      this._dependencies = HashSet.add(this._dependencies, dependency);
    });
  }

  removeDependency(dependency: DependencySignal) {
    return Effect.sync(() => {
      this._dependencies = HashSet.remove(this._dependencies, dependency);
    });
  }

  clearDependencies() {
    return Effect.sync(() => {
      HashSet.forEach(this._dependencies, (dependency) =>
        dependency.removeDependent(this),
      );
      this._dependencies = HashSet.empty();
    });
  }

  getDependencies(): Effect.Effect<DependencySignal[], never, never> {
    return Effect.sync(() => HashSet.toValues(this._dependencies));
  }

  getDependents(): Effect.Effect<
    (WeakRef<DependentSignal> | DependentSignal)[],
    never,
    never
  > {
    return Effect.sync(() => HashSet.toValues(this._dependents));
  }

  valueLocal(): Effect.Effect<A, E, R | SignalContext> {
    return pipe(
      bindScopeDependency(this),
      Effect.flatMap(() => this.peek()),
      Observable.withSpan(this, "Computed.valueLocal", {
        captureStackTrace: true,
      }),
    );
  }

  value(): Effect.Effect<
    A,
    E,
    R | SignalContext | SignalService.SignalService
  > {
    return pipe(
      Effect.all({
        context: Effect.context<R>(),
        signalContext: SignalContext,
      }),
      Effect.flatMap(({ context, signalContext }) =>
        SignalService.SignalService.enqueueRunTracked({
          effect: pipe(this.valueLocal(), Effect.provide(context)),
          ctx: signalContext,
        }),
      ),
      Observable.withSpan(this, "Computed.value", {
        captureStackTrace: true,
      }),
    );
  }

  commit(): Effect.Effect<
    A,
    E,
    R | SignalContext | SignalService.SignalService
  > {
    return this.value();
  }

  peek(): Effect.Effect<A, E, R> {
    return pipe(
      TQueue.peekOption(this._queue),
      STM.commit,
      Effect.flatMap(
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            TSemaphore.withPermit(this._semaphore)(
              pipe(
                fromDependent(this),
                runAndTrackEffect(this._effect),
                Effect.exit,
                Effect.tap((exit) =>
                  pipe(TQueue.offer(this._queue, exit), STM.commit),
                ),
              ),
            ),
        }),
      ),
      Effect.flatten,
      Observable.withSpan(this, "Computed.peek", {
        captureStackTrace: true,
      }),
    );
  }

  reset(): Effect.Effect<void, never, never> {
    return pipe(
      TQueue.takeAll(this._queue),
      STM.commit,
      Effect.asVoid,
      Observable.withSpan(this, "Computed.reset", {
        captureStackTrace: true,
      }),
    );
  }

  getReferenceForDependency(): Effect.Effect<
    WeakRef<DependentSignal> | DependentSignal,
    never,
    never
  > {
    return Effect.sync(() => this._reference);
  }

  notify(): Effect.Effect<unknown, never, never> {
    return pipe(
      this.clearDependencies(),
      Effect.andThen(this.reset()),
      Observable.withSpan(this, "Computed.notify", {
        captureStackTrace: true,
      }),
    );
  }

  recompute(): Effect.Effect<void, never, never> {
    return pipe(
      this,
      notifyAllDependents(() => this.reset()),
      Observable.withSpan(this, "Computed.recompute", {
        captureStackTrace: true,
      }),
    );
  }

  reconcile(): Effect.Effect<void, never, never> {
    return Effect.void;
  }
}

export type Success<S extends Computed<unknown, unknown, unknown>> =
  Effect.Effect.Success<ReturnType<S["peek"]>>;

export type Error<S extends Computed<unknown, unknown, unknown>> =
  Effect.Effect.Error<ReturnType<S["peek"]>>;

export type Context<S extends Computed<unknown, unknown, unknown>> =
  Effect.Effect.Context<ReturnType<S["peek"]>>;

export const make = <A = never, E = never, R = never>(
  effect: Effect.Effect<A, E, R>,
  options?: Observable.ObservableOptions,
) =>
  pipe(
    STM.all({
      queue: TQueue.sliding<Exit.Exit<A, E>>(1),
      semaphore: TSemaphore.make(1),
    }),
    STM.map(
      ({ queue, semaphore }) =>
        new Computed<A, E, Exclude<R, SignalContext>>(
          effect as Effect.Effect<A, E, Exclude<R, SignalContext>>,
          queue,
          semaphore,
          options ?? {},
        ),
    ),
    STM.commit,
    Observable.withSpan(
      { [Observable.ObservableSymbol]: options ?? {} },
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
