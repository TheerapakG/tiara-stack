import type {
  QueryRowType,
  Output,
  Change,
  Input,
  Format,
  ReadonlyJSONValue,
  View,
  HumanReadable,
} from "@rocicorp/zero";
import { applyChange } from "@rocicorp/zero";
import {
  Context,
  Effect,
  Either,
  Option,
  pipe,
  Scope,
  TRef,
  Match,
  Array,
  Predicate,
  Fiber,
  STM,
  TQueue,
} from "effect";
import * as SignalService from "../signalService";
import {
  complete,
  optimistic,
  isComplete as isResultComplete,
  type Result,
} from "../../schema/result";
import {
  ZeroQueryAppError,
  ZeroQueryHttpError,
  ZeroQueryZeroError,
  type ZeroQueryError,
  type RawZeroQueryError,
} from "../../error/zero";
import type { ExternalSource } from "../externalComputed";
import { ZeroService } from "../../services/zeroService";
import {
  SignalContext,
  getMaybeSignalEffectValue,
  type MaybeSignalEffectValue,
} from "../signalContext";
import * as SideEffect from "../sideEffect";

/**
 * Creates an ExternalSource adapter for Zero queries.
 *
 * This adapter uses Zero.materialize to subscribe to query changes.
 * Values are optimistically resolved from local cache, so no initial value is needed.
 * The adapter stores values immediately upon emission (before start/after stop)
 * to capture values, but only emits them when started.
 *
 * The implementation:
 * - Uses Zero.materialize to create a TypedView
 * - Subscribes to view changes via addListener
 * - Stores every value in a Ref for polling (regardless of start/stop state)
 * - Emits every value via the onEmit callback when started
 * - Wraps values in Result<Either<T, Error>> combining input and Zero sync status:
 *   - Optimistic: when input is optimistic OR Zero sync is incomplete
 *   - Complete: when BOTH input is complete AND Zero sync is complete
 *
 * When used with MaybeSignalEffect queries:
 * - Uses SideEffect internally to track input signal changes
 * - Automatically replaces materialized views when input changes
 * - Keeps old view's data visible until new view hydrates
 * - Propagates input signal errors inside Either.left
 *
 * @param query - The Zero query to materialize (can be MaybeSignalEffect)
 * @param options - Optional options for materialize
 * @returns An ExternalSource that requires ZeroService and Scope during creation
 */
type TimeUnit = "s" | "m" | "h" | "d" | "y";

/**
 * Time To Live. This is used for query expiration.
 * - `forever` means the query will never expire.
 * - `none` means the query will expire immediately.
 * - A number means the query will expire after that many milliseconds.
 * - A negative number means the query will never expire, this is same as 'forever'.
 * - A string like `1s` means the query will expire after that many seconds.
 * - A string like `1m` means the query will expire after that many minutes.
 * - A string like `1h` means the query will expire after that many hours.
 * - A string like `1d` means the query will expire after that many days.
 * - A string like `1y` means the query will expire after that many years.
 */
type TTL = `${number}${TimeUnit}` | "forever" | "none" | number;

/**
 * Options for materializing a Zero query.
 */
export type ZeroMaterializeOptions = {
  /**
   * Time To Live. This is the amount of time to keep the rows associated with
   * this query after cleanup has been called.
   */
  ttl?: TTL | undefined;
};

/**
 * Converts a raw Zero query error to a typed ZeroQueryError
 */
const rawZeroQueryErrorToZeroQueryError = (
  error: RawZeroQueryError,
): ZeroQueryError =>
  pipe(
    Match.value(error),
    Match.discriminatorsExhaustive("error")({
      app: (error) =>
        new ZeroQueryAppError({
          id: error.id,
          name: error.name,
          details: error.details,
        }),
      http: (error) =>
        new ZeroQueryHttpError({
          id: error.id,
          name: error.name,
          status: error.status,
          details: error.details,
        }),
      zero: (error) =>
        new ZeroQueryZeroError({
          id: error.id,
          name: error.name,
          details: error.details,
        }),
    }),
  );

/**
 * Represents the current materialized view state
 */
type ViewState = {
  readonly input: Input;
  readonly format: Format;
  readonly onDestroy: () => void;
};

/**
 * External source for Zero queries with unified output type.
 * Output: Result<Either<T, ZeroQueryError | E>>
 *
 * The outer Result status combines input Result status (if applicable) with Zero sync status:
 * - Complete only when BOTH input is Complete AND Zero sync is complete
 * - Optimistic in all other cases
 *
 * The inner Either handles:
 * - Either.right<T>: successful data
 * - Either.left<ZeroQueryError | E>: errors from input signal or Zero sync
 */
class ZeroQueryExternalSource<T extends ReadonlyJSONValue | View, E = never>
  implements
    ExternalSource<Result<Either.Either<T, ZeroQueryError | E>>>,
    Output
{
  constructor(
    private readonly viewRef: TRef.TRef<Option.Option<ViewState>>,
    private readonly inputResultCompleteRef: TRef.TRef<boolean>,
    private readonly zeroResultTypeRef: TRef.TRef<
      Either.Either<"unknown" | "complete", ZeroQueryError>
    >,
    private readonly dirtyRef: TRef.TRef<boolean>,
    private readonly valueRef: TRef.TRef<{ "": T }>,
    private readonly startedRef: TRef.TRef<boolean>,
    private readonly onEmitRef: TRef.TRef<
      Option.Option<
        (
          value: Result<Either.Either<T, ZeroQueryError | E>>,
        ) => Effect.Effect<void, never, SignalService.SignalService>
      >
    >,
    private readonly inputErrorRef: TRef.TRef<Option.Option<E>>,
  ) {}

  hydrate() {
    return pipe(
      STM.all({
        value: TRef.get(this.valueRef),
        viewOption: TRef.get(this.viewRef),
      }),
      STM.commit,
      Effect.tap(({ value, viewOption }) =>
        pipe(
          viewOption,
          Option.match({
            onSome: ({ input, format }) =>
              pipe(
                input.fetch({}),
                Array.forEach((node) =>
                  applyChange(
                    value,
                    { type: "add", node },
                    input.getSchema(),
                    "",
                    format,
                  ),
                ),
              ),
            onNone: () => Effect.void,
          }),
        ),
      ),
      Effect.andThen(pipe(TRef.set(this.dirtyRef, true), STM.commit)),
    );
  }

  flush() {
    return pipe(
      TRef.getAndSet(this.dirtyRef, false),
      STM.commit,
      Effect.flatMap((dirty) =>
        pipe(dirty ? this.doEmit() : Effect.void, Effect.as(false)),
      ),
    );
  }

  push(change: Change) {
    Effect.runFork(
      pipe(
        STM.all({
          value: TRef.get(this.valueRef),
          viewOption: TRef.get(this.viewRef),
        }),
        STM.commit,
        Effect.tap(({ value, viewOption }) =>
          pipe(
            viewOption,
            Option.match({
              onSome: ({ input, format }) =>
                applyChange(value, change, input.getSchema(), "", format),
              onNone: () => Effect.void,
            }),
          ),
        ),
        Effect.andThen(pipe(TRef.set(this.dirtyRef, true), STM.commit)),
      ),
    );
  }

  poll() {
    return pipe(
      STM.all({
        value: TRef.get(this.valueRef),
        inputResultComplete: TRef.get(this.inputResultCompleteRef),
        zeroResultType: TRef.get(this.zeroResultTypeRef),
        inputError: TRef.get(this.inputErrorRef),
      }),
      STM.map(({ value, inputResultComplete, zeroResultType, inputError }) =>
        pipe(
          inputError,
          Option.match({
            onSome: (error) =>
              // Input signal errored - wrap in Result based on input status
              inputResultComplete
                ? complete(Either.left<ZeroQueryError | E>(error))
                : optimistic(Either.left<ZeroQueryError | E>(error)),
            onNone: () =>
              pipe(
                zeroResultType,
                Either.match({
                  onLeft: (zeroError) =>
                    // Zero sync errored - wrap in Result based on combined status
                    inputResultComplete
                      ? complete(Either.left<ZeroQueryError | E>(zeroError))
                      : optimistic(Either.left<ZeroQueryError | E>(zeroError)),
                  onRight: (zeroStatus) => {
                    // Both input complete AND zero complete -> Complete
                    // Otherwise -> Optimistic
                    const isComplete =
                      inputResultComplete && zeroStatus === "complete";
                    const eitherValue: Either.Either<T, ZeroQueryError | E> =
                      Either.right(value[""]);
                    return isComplete
                      ? complete(eitherValue)
                      : optimistic(eitherValue);
                  },
                }),
              ),
          }),
        ),
      ),
    );
  }

  emit(
    onEmit: (
      value: Result<Either.Either<T, ZeroQueryError | E>>,
    ) => Effect.Effect<void, never, SignalService.SignalService>,
  ) {
    return TRef.set(this.onEmitRef, Option.some(onEmit));
  }

  doEmit() {
    return pipe(
      this.poll(),
      STM.commit,
      Effect.tap((result) =>
        pipe(
          TRef.get(this.onEmitRef),
          STM.commit,
          Effect.flatMap(Effect.transposeMapOption((onEmit) => onEmit(result))),
        ),
      ),
      Effect.whenEffect(pipe(TRef.get(this.startedRef), STM.commit)),
    );
  }

  start() {
    return TRef.set(this.startedRef, true);
  }

  stop() {
    return TRef.set(this.startedRef, false);
  }
}

/**
 * Destroys the current view and clears the view ref
 */
const destroyView = (viewRef: TRef.TRef<Option.Option<ViewState>>) =>
  pipe(
    TRef.getAndSet(viewRef, Option.none()),
    STM.commit,
    Effect.tap(
      Option.match({
        onSome: ({ onDestroy }) => pipe(Effect.sync(() => onDestroy())),
        onNone: () => Effect.void,
      }),
    ),
  );

/**
 * Creates the shared refs and source for both make variants
 */
const createSourceWithRefs = <
  T extends ReadonlyJSONValue | View,
  E = never,
>() =>
  pipe(
    STM.all({
      viewRef: TRef.make<Option.Option<ViewState>>(Option.none()),
      inputResultCompleteRef: TRef.make(true), // Default true for non-Result inputs
      zeroResultTypeRef: TRef.make<
        Either.Either<"unknown" | "complete", ZeroQueryError>
      >(Either.right("unknown")),
      dirtyRef: TRef.make(false),
      valueRef: TRef.make<{ "": T }>({
        "": undefined as T,
      }),
      startedRef: TRef.make(false),
      onEmitRef: TRef.make<
        Option.Option<
          (
            value: Result<Either.Either<T, ZeroQueryError | E>>,
          ) => Effect.Effect<void, never, SignalService.SignalService>
        >
      >(Option.none()),
      inputErrorRef: TRef.make<Option.Option<E>>(Option.none()),
      queryCompletePromiseFiberRef: TRef.make<
        Option.Option<Fiber.Fiber<void, never>>
      >(Option.none()),
      materializedQueue: TQueue.sliding<void>(1),
    }),
    STM.let(
      "source",
      ({
        viewRef,
        inputResultCompleteRef,
        zeroResultTypeRef,
        dirtyRef,
        valueRef,
        startedRef,
        onEmitRef,
        inputErrorRef,
      }) =>
        new ZeroQueryExternalSource<T, E>(
          viewRef,
          inputResultCompleteRef,
          zeroResultTypeRef,
          dirtyRef,
          valueRef,
          startedRef,
          onEmitRef,
          inputErrorRef,
        ),
    ),
  );

/**
 * Creates the materialize callback for Zero queries
 */
const createMaterializeCallback =
  <T extends ReadonlyJSONValue | View, E = never>(
    source: ZeroQueryExternalSource<T, E>,
    viewRef: TRef.TRef<Option.Option<ViewState>>,
    zeroResultTypeRef: TRef.TRef<
      Either.Either<"unknown" | "complete", ZeroQueryError>
    >,
    valueRef: TRef.TRef<{ "": T }>,
    queryCompletePromiseFiberRef: TRef.TRef<
      Option.Option<Fiber.Fiber<void, never>>
    >,
    materializedQueue: TQueue.TQueue<void>,
  ) =>
  (
    _query: unknown,
    input: Input,
    format: Format,
    onDestroy: () => void,
    onTransactionCommit: (cb: () => void) => void,
    queryComplete: boolean | Promise<true> | RawZeroQueryError,
    _updateTTL: unknown,
  ) =>
    pipe(
      Effect.Do,
      Effect.tap(() => destroyView(viewRef)),
      Effect.bind("newQueryCompletePromiseFiber", () =>
        pipe(
          Match.value(queryComplete),
          Match.when(Predicate.isPromiseLike, (queryComplete) =>
            pipe(
              Effect.tryPromise({
                try: () => queryComplete,
                catch: (error) =>
                  rawZeroQueryErrorToZeroQueryError(error as RawZeroQueryError),
              }),
              Effect.as("complete" as const),
              Effect.either,
              Effect.tap((result) =>
                pipe(TRef.set(zeroResultTypeRef, result), STM.commit),
              ),
              Effect.andThen(source.doEmit()),
              Effect.asVoid,

              Effect.forkDaemon,
              Effect.map(Option.some),
            ),
          ),
          Match.orElse(() => Effect.succeedNone),
        ),
      ),
      Effect.bind(
        "oldQueryCompletePromiseFiber",
        ({ newQueryCompletePromiseFiber }) =>
          pipe(
            TRef.set(viewRef, Option.some({ input, format, onDestroy })),
            STM.zipRight(
              TRef.set(valueRef, {
                "": (format.singular ? undefined : []) as T,
              }),
            ),
            STM.zipRight(
              pipe(
                Match.value(queryComplete),
                Match.when(true, () =>
                  TRef.set(zeroResultTypeRef, Either.right("complete")),
                ),
                Match.when(Predicate.hasProperty("error"), (error) =>
                  TRef.set(
                    zeroResultTypeRef,
                    Either.left(
                      rawZeroQueryErrorToZeroQueryError(
                        error as RawZeroQueryError,
                      ),
                    ),
                  ),
                ),
                Match.orElse(() =>
                  TRef.set(zeroResultTypeRef, Either.right("unknown")),
                ),
              ),
            ),
            STM.zipRight(
              TRef.getAndSet(
                queryCompletePromiseFiberRef,
                newQueryCompletePromiseFiber,
              ),
            ),
            STM.commit,
          ),
      ),
      Effect.andThen(({ oldQueryCompletePromiseFiber }) =>
        pipe(
          oldQueryCompletePromiseFiber,
          Effect.transposeMapOption((fiber) => Fiber.interrupt(fiber)),
        ),
      ),
      Effect.andThen(() => input.setOutput(source)),
      Effect.andThen(() => source.hydrate()),
      Effect.andThen(() =>
        pipe(
          SignalService.SignalService,
          Effect.tap((service) =>
            Effect.sync(() =>
              onTransactionCommit(() =>
                Effect.runFork(
                  pipe(
                    source.flush(),
                    Effect.provideService(SignalService.SignalService, service),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      Effect.andThen(() =>
        pipe(TQueue.offer(materializedQueue, undefined), STM.commit),
      ),
      Effect.asVoid,
    );

export const makeWithContext = <
  M,
  Q = Effect.Effect.Success<MaybeSignalEffectValue<M>>,
  T extends ReadonlyJSONValue | View = HumanReadable<
    QueryRowType<Q>
  > extends infer T extends ReadonlyJSONValue | View
    ? T
    : never,
  E = Effect.Effect.Error<MaybeSignalEffectValue<M>>,
  R = Effect.Effect.Context<MaybeSignalEffectValue<M>>,
>(
  maybeSignalQuery: M,
  context: Context.Context<Exclude<R, SignalContext>>,
  options?: ZeroMaterializeOptions,
): Effect.Effect<
  ZeroQueryExternalSource<T, E>,
  never,
  ZeroService<any, any> | Scope.Scope | SignalService.SignalService
> =>
  pipe(
    ZeroService<any, any>(),
    Effect.andThen((zero) =>
      pipe(
        createSourceWithRefs<T, E>(),
        STM.commit,
        Effect.tap(
          ({
            source,
            viewRef,
            inputResultCompleteRef,
            zeroResultTypeRef,
            valueRef,
            inputErrorRef,
            queryCompletePromiseFiberRef,
            materializedQueue,
          }) =>
            pipe(
              SignalService.SignalService,
              Effect.flatMap((service) =>
                SideEffect.makeWithContext(
                  pipe(
                    getMaybeSignalEffectValue(
                      maybeSignalQuery,
                    ) as Effect.Effect<Q, E, R | SignalContext>,
                    Effect.either,
                    Effect.flatMap((queryResult) =>
                      pipe(
                        queryResult,
                        Either.match({
                          onLeft: (error) =>
                            pipe(
                              destroyView(viewRef),
                              Effect.andThen(
                                pipe(
                                  TRef.set(inputErrorRef, Option.some(error)), // Input errors with non-Result input are considered complete
                                  STM.zipRight(
                                    TRef.set(inputResultCompleteRef, true),
                                  ),
                                  STM.commit,
                                ),
                              ),
                              Effect.andThen(source.doEmit()),
                            ),
                          onRight: (query) =>
                            pipe(
                              TRef.set(inputErrorRef, Option.none()),
                              // Non-Result input is always considered complete
                              STM.zipRight(
                                TRef.set(inputResultCompleteRef, true),
                              ),
                              STM.commit,
                              Effect.andThen(
                                zero.materialize(
                                  query,
                                  createMaterializeCallback(
                                    source,
                                    viewRef,
                                    zeroResultTypeRef,
                                    valueRef,
                                    queryCompletePromiseFiberRef,
                                    materializedQueue,
                                  ),
                                  options,
                                ),
                              ),
                            ),
                        }),
                      ),
                    ),
                    Effect.provideService(SignalService.SignalService, service),
                  ),
                  context,
                ),
              ),
            ),
        ),
        Effect.tap(({ viewRef }) =>
          Effect.addFinalizer(() => destroyView(viewRef)),
        ),
        Effect.tap(({ materializedQueue }) => TQueue.take(materializedQueue)),
        Effect.map(({ source }) => source),
      ),
    ),
  );

export const make = <
  M,
  Q = Effect.Effect.Success<MaybeSignalEffectValue<M>>,
  T extends ReadonlyJSONValue | View = HumanReadable<
    QueryRowType<Q>
  > extends infer T extends ReadonlyJSONValue | View
    ? T
    : never,
>(
  maybeSignalQuery: M,
  options?: ZeroMaterializeOptions,
): Effect.Effect<
  ZeroQueryExternalSource<T, never>,
  never,
  ZeroService<any, any> | Scope.Scope | SignalService.SignalService
> =>
  makeWithContext<M, Q, T, never, never>(
    maybeSignalQuery,
    Context.empty(),
    options,
  );

/**
 * Creates an ExternalSource for Zero queries where the input is wrapped in a Result type.
 *
 * The output type is Result<Either<T, Error>> where:
 * - The outer Result combines input Result status AND Zero sync status
 * - Complete only when BOTH input is Complete AND Zero sync is complete
 * - The inner Either handles success data vs errors
 */
export const makeFromResultWithContext = <
  M,
  Q = Effect.Effect.Success<MaybeSignalEffectValue<M>> extends Result<
    infer QO,
    infer QC
  >
    ? QO | QC
    : never,
  T extends ReadonlyJSONValue | View = HumanReadable<
    QueryRowType<Q>
  > extends infer T extends ReadonlyJSONValue | View
    ? T
    : never,
  E = Effect.Effect.Error<MaybeSignalEffectValue<M>>,
  R = Effect.Effect.Context<MaybeSignalEffectValue<M>>,
>(
  maybeSignalQuery: M,
  context: Context.Context<Exclude<R, SignalContext>>,
  options?: ZeroMaterializeOptions,
): Effect.Effect<
  ZeroQueryExternalSource<T, E>,
  never,
  ZeroService<any, any> | Scope.Scope | SignalService.SignalService
> =>
  pipe(
    ZeroService<any, any>(),
    Effect.andThen((zero) =>
      pipe(
        createSourceWithRefs<T, E>(),
        // Set inputResultCompleteRef to false initially for Result inputs
        STM.tap(({ inputResultCompleteRef }) =>
          TRef.set(inputResultCompleteRef, false),
        ),
        STM.commit,
        Effect.tap(
          ({
            source,
            viewRef,
            inputResultCompleteRef,
            zeroResultTypeRef,
            valueRef,
            inputErrorRef,
            queryCompletePromiseFiberRef,
            materializedQueue,
          }) =>
            pipe(
              SignalService.SignalService,
              Effect.flatMap((service) =>
                SideEffect.makeWithContext(
                  pipe(
                    getMaybeSignalEffectValue(
                      maybeSignalQuery,
                    ) as Effect.Effect<Result<Q>, E, R | SignalContext>,
                    Effect.either,
                    Effect.flatMap((queryResultEither) =>
                      pipe(
                        queryResultEither,
                        Either.match({
                          onLeft: (error) =>
                            pipe(
                              destroyView(viewRef),
                              Effect.andThen(
                                pipe(
                                  TRef.set(inputErrorRef, Option.some(error)),
                                  STM.zipRight(
                                    TRef.set(inputResultCompleteRef, true),
                                  ),
                                  STM.commit,
                                ),
                              ),
                              Effect.andThen(source.doEmit()),
                            ),
                          onRight: (queryResult) =>
                            pipe(
                              TRef.set(inputErrorRef, Option.none()),
                              STM.zipRight(
                                TRef.set(
                                  inputResultCompleteRef,
                                  isResultComplete(queryResult),
                                ),
                              ),
                              // Extract the query from the Result and materialize
                              Effect.andThen(
                                zero.materialize(
                                  queryResult.value,
                                  createMaterializeCallback(
                                    source,
                                    viewRef,
                                    zeroResultTypeRef,
                                    valueRef,
                                    queryCompletePromiseFiberRef,
                                    materializedQueue,
                                  ),
                                  options,
                                ),
                              ),
                            ),
                        }),
                      ),
                    ),
                    Effect.provideService(SignalService.SignalService, service),
                  ),
                  context,
                ),
              ),
            ),
        ),
        Effect.tap(({ viewRef }) =>
          Effect.addFinalizer(() => destroyView(viewRef)),
        ),
        Effect.tap(({ materializedQueue }) => TQueue.take(materializedQueue)),
        Effect.map(({ source }) => source),
      ),
    ),
  );

export const makeFromResult = <
  M,
  Q = Effect.Effect.Success<MaybeSignalEffectValue<M>> extends Result<
    infer Q,
    infer _C
  >
    ? Q
    : never,
  T extends ReadonlyJSONValue | View = HumanReadable<
    QueryRowType<Q>
  > extends infer T extends ReadonlyJSONValue | View
    ? T
    : never,
>(
  maybeSignalQuery: M,
  options?: ZeroMaterializeOptions,
): Effect.Effect<
  ZeroQueryExternalSource<T, never>,
  never,
  ZeroService<any, any> | Scope.Scope | SignalService.SignalService
> =>
  makeFromResultWithContext<M, Q, T, never, never>(
    maybeSignalQuery,
    Context.empty(),
    options,
  );
