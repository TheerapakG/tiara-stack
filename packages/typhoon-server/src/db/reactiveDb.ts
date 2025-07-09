import { match } from "arktype";
import { Dialect } from "drizzle-orm";
import { RunnableQuery } from "drizzle-orm/runnable-query";
import {
  Context,
  Effect,
  HashMap,
  HashSet,
  Option,
  pipe,
  SynchronizedRef,
} from "effect";
import {
  bindScopeDependency,
  Computed,
  computed,
  SignalContext,
} from "typhoon-core/signal";

type TransactionSubscription = { mode: "subscription" };
type TransactionMutation = {
  mode: "mutation";
  tables: HashSet.HashSet<string>;
};

export class TransactionContext extends Context.Tag("TransactionContext")<
  TransactionContext,
  | SynchronizedRef.SynchronizedRef<TransactionSubscription>
  | SynchronizedRef.SynchronizedRef<TransactionMutation>
>() {
  static subscription(): Effect.Effect<
    SynchronizedRef.SynchronizedRef<TransactionSubscription>
  > {
    return SynchronizedRef.make({ mode: "subscription" });
  }

  static mutation(): Effect.Effect<
    SynchronizedRef.SynchronizedRef<TransactionMutation>
  > {
    return SynchronizedRef.make({
      mode: "mutation",
      tables: HashSet.empty<string>(),
    });
  }

  static mode() {
    return pipe(
      TransactionContext,
      Effect.flatMap((context) =>
        SynchronizedRef.get(
          context as SynchronizedRef.SynchronizedRef<
            TransactionSubscription | TransactionMutation
          >,
        ),
      ),
      Effect.map((context) => context.mode),
    );
  }

  static ofMode<T extends "subscription" | "mutation">(
    mode: T,
  ): T extends "subscription"
    ? Effect.Effect<SynchronizedRef.SynchronizedRef<TransactionSubscription>>
    : T extends "mutation"
      ? Effect.Effect<SynchronizedRef.SynchronizedRef<TransactionMutation>>
      : never {
    return match({
      "'subscription'": () => TransactionContext.subscription(),
      "'mutation'": () => TransactionContext.mutation(),
      default: "never",
    })(mode) as unknown as T extends "subscription"
      ? Effect.Effect<SynchronizedRef.SynchronizedRef<TransactionSubscription>>
      : T extends "mutation"
        ? Effect.Effect<SynchronizedRef.SynchronizedRef<TransactionMutation>>
        : never;
  }
}

export class BaseDBSubscriptionContext extends Effect.Service<BaseDBSubscriptionContext>()(
  "BaseDBSubscriptionContext",
  {
    effect: pipe(
      Effect.Do,
      Effect.bind("subscriptions", () =>
        SynchronizedRef.make(HashMap.empty<string, Computed<void, never>>()),
      ),
      Effect.map(({ subscriptions }) => ({
        subscriptions,
        subscribeTables: (tables: string[]) =>
          pipe(
            subscriptions,
            SynchronizedRef.updateAndGetEffect((subscriptions) =>
              Effect.reduce(tables, subscriptions, (subscriptions, table) =>
                pipe(
                  Effect.Do,
                  Effect.bind("newComputed", () => computed(Effect.void)),
                  Effect.let("newSubscriptions", ({ newComputed }) =>
                    pipe(
                      subscriptions,
                      HashMap.modifyAt(table, (signal) =>
                        pipe(
                          signal,
                          Option.match({
                            onNone: () => Option.some(newComputed),
                            onSome: (signal) => Option.some(signal),
                          }),
                        ),
                      ),
                    ),
                  ),
                  Effect.tap(({ newSubscriptions }) =>
                    bindScopeDependency(
                      HashMap.unsafeGet(newSubscriptions, table),
                    ),
                  ),
                  Effect.map(({ newSubscriptions }) => newSubscriptions),
                ),
              ),
            ),
          ),
        notifyTables: (tables: string[]) =>
          pipe(
            SynchronizedRef.get(subscriptions),
            Effect.map((subscriptions) =>
              tables.map((table) => HashMap.get(subscriptions, table)),
            ),
            Effect.map((signals) =>
              signals.map((signal) =>
                pipe(
                  signal,
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: (signal) => signal.recompute(),
                  }),
                ),
              ),
            ),
            Effect.flatMap(Effect.all),
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
  query: Effect.Effect<T, unknown>;
  tables: HashSet.HashSet<string>;
};

export const query = <T, TDialect extends Dialect>(
  query: RunnableQuery<T, TDialect>,
): Effect.Effect<QueryAnalysis<T>, unknown, TransactionContext> =>
  pipe(
    Effect.Do,
    // @ts-expect-error drizzle internal
    Effect.let("preparedQuery", () => query._prepare()),
    Effect.let("tables", ({ preparedQuery }) =>
      HashSet.make(...(preparedQuery.queryMetadata.tables as string[])),
    ),
    Effect.let("query", ({ preparedQuery }) =>
      Effect.tryPromise(() => preparedQuery.execute() as Promise<T>),
    ),
    Effect.map(({ query, tables }) => ({ query, tables })),
  );

export const run = <T>(
  query: Effect.Effect<QueryAnalysis<T>, unknown, TransactionContext>,
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
    Effect.tap(({ transactionContext, queryAnalysis }) =>
      SynchronizedRef.updateEffect(
        transactionContext as SynchronizedRef.SynchronizedRef<
          TransactionSubscription | TransactionMutation
        >,
        (context) =>
          match
            .in<TransactionSubscription | TransactionMutation>()
            .case({ mode: "'subscription'" }, (context) =>
              pipe(
                BaseDBSubscriptionContext.subscribeTables(
                  HashSet.toValues(queryAnalysis.tables),
                ),
                Effect.as(context),
              ),
            )
            .case({ mode: "'mutation'" }, (context) =>
              Effect.succeed({
                ...context,
                tables: HashSet.union(context.tables, queryAnalysis.tables),
              }),
            )
            .default("never")(context),
      ),
    ),
    Effect.bind("result", ({ queryAnalysis }) =>
      pipe(queryAnalysis.query, Effect.either),
    ),
    Effect.flatMap(({ result }) => result),
  );

export const subscribe = <A, E>(
  query: Effect.Effect<
    A,
    E,
    TransactionContext | BaseDBSubscriptionContext | SignalContext
  >,
) =>
  pipe(
    Effect.Do,
    Effect.bind("transactionContext", () =>
      TransactionContext.ofMode("subscription"),
    ),
    Effect.bind("dbSubscriptionContext", () => BaseDBSubscriptionContext),
    Effect.bind(
      "computedQuery",
      ({ transactionContext, dbSubscriptionContext }) =>
        computed(
          pipe(
            query,
            Effect.provideService(TransactionContext, transactionContext),
            Effect.provideService(
              BaseDBSubscriptionContext,
              dbSubscriptionContext,
            ),
          ),
        ),
    ),
    Effect.map(({ computedQuery }) => computedQuery),
  );

export const subscribeQuery = <T, TDialect extends Dialect>(
  q: RunnableQuery<T, TDialect>,
) => pipe(q, query, run, subscribe);

export const mutate = <A, E>(
  query: Effect.Effect<
    A,
    E,
    TransactionContext | BaseDBSubscriptionContext | SignalContext
  >,
) =>
  pipe(
    Effect.Do,
    Effect.bind("dummyComputed", () => computed(Effect.void)),
    Effect.bind("result", ({ dummyComputed }) =>
      pipe(
        query,
        Effect.provideService(
          SignalContext,
          SignalContext.fromDependent(dummyComputed),
        ),
        Effect.either,
      ),
    ),
    Effect.bind("transactionContext", () => TransactionContext),
    Effect.tap(({ transactionContext }) =>
      pipe(
        SynchronizedRef.get(
          transactionContext as SynchronizedRef.SynchronizedRef<
            TransactionSubscription | TransactionMutation
          >,
        ),
        Effect.map((context) =>
          match
            .in<TransactionSubscription | TransactionMutation>()
            .case({ mode: "'subscription'" }, () => HashSet.empty<string>())
            .case({ mode: "'mutation'" }, (context) => context.tables)
            .default("never")(context),
        ),
        Effect.map(HashSet.toValues),
        Effect.flatMap(BaseDBSubscriptionContext.notifyTables),
      ),
    ),
    Effect.flatMap(({ result }) => result),
    Effect.provideServiceEffect(
      TransactionContext,
      TransactionContext.ofMode("mutation"),
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
      TransactionContext | BaseDBSubscriptionContext | SignalContext
    >,
    config?: Config,
  ) => Effect.Effect<
    T,
    unknown,
    TransactionContext | BaseDBSubscriptionContext | SignalContext
  >) =>
  (fn, config) =>
    pipe(
      Effect.Do,
      Effect.bind("context", () =>
        Effect.context<
          TransactionContext | BaseDBSubscriptionContext | SignalContext
        >(),
      ),
      Effect.bind("result", ({ context }) =>
        Effect.tryPromise(() =>
          transactionFn(
            (tx) => Effect.runPromise(pipe(fn(tx), Effect.provide(context))),
            config,
          ),
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
    query: Effect.Effect<A, E, TransactionContext | SignalContext>,
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
    query: Effect.Effect<A, E, TransactionContext | SignalContext>,
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
        TransactionContext | BaseDBSubscriptionContext | SignalContext
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
