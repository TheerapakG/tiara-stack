import type { Dialect } from "drizzle-orm";
import type { RunnableQuery } from "drizzle-orm/runnable-query";
import {
  Context,
  Effect,
  HashMap,
  HashSet,
  Match,
  Option,
  pipe,
  Schema,
  SynchronizedRef,
  Array,
  Runtime,
  Scope,
} from "effect";
import { DBQueryError, makeDBQueryError } from "typhoon-core/error";
import {
  Computed,
  SignalContext,
  ExternalComputed,
  ManualEmitExternalSource,
  WithScopeComputed,
  SignalService,
} from "typhoon-core/signal";

class TransactionSubscription extends Schema.TaggedClass<TransactionSubscription>()(
  "TransactionSubscription",
  {
    tables: Schema.HashSetFromSelf(Schema.String),
  },
) {}

class TransactionMutation extends Schema.TaggedClass<TransactionMutation>()(
  "TransactionMutation",
  {
    tables: Schema.HashSetFromSelf(Schema.String),
  },
) {}

export class TransactionContext extends Context.Tag("TransactionContext")<
  TransactionContext,
  | SynchronizedRef.SynchronizedRef<TransactionSubscription>
  | SynchronizedRef.SynchronizedRef<TransactionMutation>
>() {
  static subscription(): Effect.Effect<
    SynchronizedRef.SynchronizedRef<TransactionSubscription>
  > {
    return SynchronizedRef.make(
      TransactionSubscription.make({
        tables: HashSet.empty<string>(),
      }),
    );
  }

  static mutation(): Effect.Effect<
    SynchronizedRef.SynchronizedRef<TransactionMutation>
  > {
    return SynchronizedRef.make(
      TransactionMutation.make({
        tables: HashSet.empty<string>(),
      }),
    );
  }

  static tables(): Effect.Effect<
    HashSet.HashSet<string>,
    never,
    TransactionContext
  > {
    return pipe(
      TransactionContext,
      Effect.flatMap((context) =>
        SynchronizedRef.get(
          context as SynchronizedRef.SynchronizedRef<
            TransactionSubscription | TransactionMutation
          >,
        ),
      ),
      Effect.map((context) => context.tables),
    );
  }
}

type TableSubscription = {
  source: ExternalComputed.ExternalComputed<void>;
  emitter: ManualEmitExternalSource.ManualEmitter<void>;
};

export class BaseDBSubscriptionContext extends Effect.Service<BaseDBSubscriptionContext>()(
  "BaseDBSubscriptionContext",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("subscriptions", () =>
        SynchronizedRef.make(HashMap.empty<string, TableSubscription>()),
      ),
      Effect.map(({ subscriptions }) => ({
        subscriptions,
        subscribeTables: (
          tables: Iterable<string>,
        ): Effect.Effect<
          Computed.Computed<void[], never, SignalService.SignalService>,
          never,
          SignalContext.SignalContext | SignalService.SignalService
        > =>
          pipe(
            subscriptions,
            SynchronizedRef.updateAndGetEffect((subscriptions) =>
              Effect.reduce(tables, subscriptions, (subscriptions, table) =>
                pipe(
                  subscriptions,
                  HashMap.get(table),
                  Option.match({
                    onNone: () =>
                      pipe(
                        ManualEmitExternalSource.make<void>(undefined),
                        Effect.flatMap(({ source, emitter }) =>
                          pipe(
                            ExternalComputed.make(source),
                            Effect.map((externalComputed) => ({
                              source: externalComputed,
                              emitter,
                            })),
                          ),
                        ),
                        Effect.map((subscription) =>
                          HashMap.set(subscriptions, table, subscription),
                        ),
                      ),
                    onSome: () => Effect.succeed(subscriptions),
                  }),
                ),
              ),
            ),
            Effect.flatMap((subscriptions) =>
              pipe(
                tables,
                Array.fromIterable,
                Array.map((table) => HashMap.get(subscriptions, table)),
                Array.getSomes,
                Array.map((subscription) => subscription.source),
                Computed.makeAll,
                Effect.tap((aggregatedSource) =>
                  SignalContext.bindScopeDependency(aggregatedSource),
                ),
              ),
            ),
          ),
        notifyTables: (
          tables: Iterable<string>,
        ): Effect.Effect<void, never, SignalService.SignalService> =>
          pipe(
            SynchronizedRef.get(subscriptions),
            Effect.flatMap((subscriptions) =>
              pipe(
                tables,
                Array.fromIterable,
                Array.map((table) => HashMap.get(subscriptions, table)),
                Array.getSomes,
                Array.map((subscription) =>
                  subscription.emitter.emit(undefined),
                ),
                Effect.all,
              ),
            ),
          ),
      })),
      Effect.map(({ subscribeTables, notifyTables }) => ({
        subscribeTables,
        notifyTables,
      })),
    ),
    accessors: true,
  },
) {}

type QueryAnalysis<T> = {
  query: Effect.Effect<T, DBQueryError>;
  tables: HashSet.HashSet<string>;
};

export const query = <T, TDialect extends Dialect>(
  query: RunnableQuery<T, TDialect>,
): Effect.Effect<QueryAnalysis<T>, never, TransactionContext> =>
  pipe(
    Effect.Do,
    // @ts-expect-error drizzle internal
    Effect.let("preparedQuery", () => query._prepare()),
    Effect.let("tables", ({ preparedQuery }) =>
      HashSet.make(...(preparedQuery.queryMetadata.tables as string[])),
    ),
    Effect.let("query", ({ preparedQuery }) =>
      pipe(
        Effect.tryPromise({
          try: () => preparedQuery.execute() as Promise<T>,
          catch: (error) =>
            makeDBQueryError(
              typeof error === "object" &&
                error !== null &&
                "message" in error &&
                typeof error.message === "string"
                ? error.message
                : "Failed to execute query",
              error,
            ),
        }),
      ),
    ),
    Effect.map(({ query, tables }) => ({ query, tables })),
  );

export const run = <T, E>(
  query: Effect.Effect<QueryAnalysis<T>, E, TransactionContext>,
) =>
  pipe(
    Effect.Do,
    Effect.bind("transactionContext", () => TransactionContext),
    Effect.bind("queryAnalysis", ({ transactionContext }) =>
      pipe(
        query,
        Effect.provideService(TransactionContext, transactionContext),
      ),
    ),
    Effect.bind("result", ({ queryAnalysis }) =>
      pipe(queryAnalysis.query, Effect.either),
    ),
    Effect.tap(({ transactionContext, queryAnalysis }) =>
      SynchronizedRef.update(
        transactionContext as SynchronizedRef.SynchronizedRef<
          TransactionSubscription | TransactionMutation
        >,
        (context) =>
          pipe(
            Match.value(context),
            Match.tagsExhaustive({
              TransactionSubscription: (context) =>
                pipe(
                  TransactionSubscription.make({
                    tables: HashSet.union(context.tables, queryAnalysis.tables),
                  }),
                ),
              TransactionMutation: (context) =>
                TransactionMutation.make({
                  tables: HashSet.union(context.tables, queryAnalysis.tables),
                }),
            }),
          ),
      ),
    ),
    Effect.flatMap(({ result }) => result),
  );

export const subscribe = <A, E>(
  query: Effect.Effect<
    A,
    E,
    TransactionContext | BaseDBSubscriptionContext | SignalContext.SignalContext
  >,
): Effect.Effect<
  WithScopeComputed.WithScopeComputed<A, E, SignalService.SignalService>,
  never,
  BaseDBSubscriptionContext | Scope.Scope
> =>
  pipe(
    BaseDBSubscriptionContext,
    Effect.flatMap((baseDBSubscriptionContext) =>
      WithScopeComputed.make(
        pipe(
          query,
          Effect.tap(() =>
            pipe(
              TransactionContext.tables(),
              Effect.flatMap(BaseDBSubscriptionContext.subscribeTables),
            ),
          ),
          Effect.provideServiceEffect(
            TransactionContext,
            TransactionContext.subscription(),
          ),
          Effect.provideService(
            BaseDBSubscriptionContext,
            baseDBSubscriptionContext,
          ),
        ),
      ),
    ),
  );

export const subscribeQuery = <T, TDialect extends Dialect>(
  q: RunnableQuery<T, TDialect>,
) => pipe(q, query, run, subscribe);

export const mutate = <A, E>(
  query: Effect.Effect<
    A,
    E,
    TransactionContext | BaseDBSubscriptionContext | SignalContext.SignalContext
  >,
): Effect.Effect<
  A,
  E,
  BaseDBSubscriptionContext | SignalService.SignalService
> =>
  pipe(
    query,
    Effect.tap(() =>
      pipe(
        TransactionContext.tables(),
        Effect.flatMap(BaseDBSubscriptionContext.notifyTables),
      ),
    ),
    Effect.provideServiceEffect(
      SignalContext.SignalContext,
      pipe(Computed.make(Effect.void), Effect.map(SignalContext.fromDependent)),
    ),
    Effect.provideServiceEffect(
      TransactionContext,
      TransactionContext.mutation(),
    ),
  );

export const mutateQuery = <T, TDialect extends Dialect>(
  q: RunnableQuery<T, TDialect>,
) => pipe(q, query, run, mutate);

export const wrapTransaction =
  <Transaction, Config>(
    transactionFn: <T>(
      fn: (tx: Transaction) => Promise<T>,
      config?: Config,
    ) => Promise<T>,
  ): (<T>(
    fn: (
      tx: Transaction,
    ) => Effect.Effect<
      T,
      unknown,
      | TransactionContext
      | BaseDBSubscriptionContext
      | SignalContext.SignalContext
      | SignalService.SignalService
    >,
    config?: Config,
  ) => Effect.Effect<
    T,
    unknown,
    | TransactionContext
    | BaseDBSubscriptionContext
    | SignalContext.SignalContext
    | SignalService.SignalService
  >) =>
  (fn, config) =>
    pipe(
      Effect.Do,
      Effect.bind("runtime", () =>
        Effect.runtime<
          | TransactionContext
          | BaseDBSubscriptionContext
          | SignalContext.SignalContext
          | SignalService.SignalService
        >(),
      ),
      Effect.bind("result", ({ runtime }) =>
        Effect.tryPromise(() =>
          transactionFn((tx) => Runtime.runPromise(runtime, fn(tx)), config),
        ),
      ),
      Effect.map(({ result }) => result),
    );

export class DBSubscriptionContext extends Effect.Service<DBSubscriptionContext>()(
  "DBSubscriptionContext",
  {
    effect: BaseDBSubscriptionContext.use((context) => ({
      base: context,
      subscribeTables: context.subscribeTables,
      notifyTables: context.notifyTables,
      subscribeQuery: <T, TDialect extends Dialect>(
        q: RunnableQuery<T, TDialect>,
      ) =>
        pipe(
          subscribeQuery(q),
          Effect.provideService(BaseDBSubscriptionContext, context),
        ),
      mutateQuery: <T, TDialect extends Dialect>(
        q: RunnableQuery<T, TDialect>,
      ) =>
        pipe(
          mutateQuery(q),
          Effect.provideService(BaseDBSubscriptionContext, context),
        ),
    })),
    accessors: true,
    dependencies: [BaseDBSubscriptionContext.Default],
  },
) {
  static run<T>(
    query: Effect.Effect<QueryAnalysis<T>, unknown, TransactionContext>,
  ) {
    return DBSubscriptionContext.use((context) =>
      pipe(
        run(query),
        Effect.provideService(BaseDBSubscriptionContext, context.base),
      ),
    );
  }

  static subscribe<A, E>(
    query: Effect.Effect<
      A,
      E,
      TransactionContext | SignalContext.SignalContext
    >,
  ) {
    return DBSubscriptionContext.use((context) =>
      pipe(
        subscribe(query),
        Effect.provideService(BaseDBSubscriptionContext, context.base),
      ),
    );
  }

  static subscribeQuery<T, TDialect extends Dialect>(
    q: RunnableQuery<T, TDialect>,
  ) {
    return DBSubscriptionContext.use((context) =>
      pipe(
        subscribeQuery(q),
        Effect.provideService(BaseDBSubscriptionContext, context.base),
      ),
    );
  }

  static mutate<A, E>(
    query: Effect.Effect<
      A,
      E,
      TransactionContext | SignalContext.SignalContext
    >,
  ) {
    return DBSubscriptionContext.use((context) =>
      pipe(
        mutate(query),
        Effect.provideService(BaseDBSubscriptionContext, context.base),
      ),
    );
  }

  static mutateQuery<T, TDialect extends Dialect>(
    q: RunnableQuery<T, TDialect>,
  ) {
    return DBSubscriptionContext.use((context) =>
      pipe(
        mutateQuery(q),
        Effect.provideService(BaseDBSubscriptionContext, context.base),
      ),
    );
  }

  static wrapTransaction<Transaction, Config>(
    transactionFn: <T>(
      fn: (tx: Transaction) => Promise<T>,
      config?: Config,
    ) => Promise<T>,
  ) {
    return <T>(
      fn: (
        tx: Transaction,
      ) => Effect.Effect<
        T,
        unknown,
        | TransactionContext
        | BaseDBSubscriptionContext
        | SignalContext.SignalContext
      >,
      config?: Config,
    ) =>
      DBSubscriptionContext.use((context) =>
        pipe(
          wrapTransaction(transactionFn)(fn, config),
          Effect.provideService(BaseDBSubscriptionContext, context.base),
        ),
      );
  }
}
