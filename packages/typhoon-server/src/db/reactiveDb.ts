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
} from "../signal";

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

export class DBSubscriptionContext extends Context.Tag("DBSubscriptionContext")<
  DBSubscriptionContext,
  {
    subscriptions: SynchronizedRef.SynchronizedRef<
      HashMap.HashMap<string, Computed<void, never>>
    >;
  }
>() {
  static empty(): Effect.Effect<Context.Tag.Service<DBSubscriptionContext>> {
    return pipe(
      SynchronizedRef.make(HashMap.empty<string, Computed<void, never>>()),
      Effect.map((subscriptions) => ({ subscriptions })),
    );
  }

  static subscribeTables(tables: string[]) {
    return pipe(
      Effect.Do,
      Effect.bind("context", () => DBSubscriptionContext),
      Effect.flatMap(({ context }) =>
        pipe(
          context.subscriptions,
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
      ),
    );
  }

  static notifyTables(tables: string[]) {
    return pipe(
      DBSubscriptionContext,
      Effect.map(({ subscriptions }) => subscriptions),
      Effect.flatMap(SynchronizedRef.get),
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
    );
  }
}

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
                DBSubscriptionContext.subscribeTables(
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
    TransactionContext | DBSubscriptionContext | SignalContext
  >,
) =>
  pipe(
    Effect.Do,
    Effect.bind("transactionContext", () =>
      TransactionContext.ofMode("subscription"),
    ),
    Effect.bind("dbSubscriptionContext", () => DBSubscriptionContext),
    Effect.bind(
      "computedQuery",
      ({ transactionContext, dbSubscriptionContext }) =>
        computed(
          pipe(
            query,
            Effect.provideService(TransactionContext, transactionContext),
            Effect.provideService(DBSubscriptionContext, dbSubscriptionContext),
          ),
        ),
    ),
    Effect.map(({ computedQuery }) => computedQuery),
  );

export const mutate = <A, E>(
  query: Effect.Effect<
    A,
    E,
    TransactionContext | DBSubscriptionContext | SignalContext
  >,
) =>
  pipe(
    Effect.Do,
    Effect.bind("dbSubscriptionContext", () => DBSubscriptionContext),
    Effect.bind("dummyComputed", () => computed(Effect.void)),
    Effect.bind("result", ({ dbSubscriptionContext, dummyComputed }) =>
      pipe(
        query,
        Effect.provideService(DBSubscriptionContext, dbSubscriptionContext),
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
        Effect.flatMap(DBSubscriptionContext.notifyTables),
      ),
    ),
    Effect.flatMap(({ result }) => result),
    Effect.provideServiceEffect(
      TransactionContext,
      TransactionContext.ofMode("mutation"),
    ),
  );

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
      TransactionContext | DBSubscriptionContext | SignalContext
    >,
    config?: Config,
  ) => Effect.Effect<
    T,
    unknown,
    TransactionContext | DBSubscriptionContext | SignalContext
  >) =>
  (fn, config) =>
    pipe(
      Effect.Do,
      Effect.bind("transactionContext", () => TransactionContext),
      Effect.bind("dbSubscriptionContext", () => DBSubscriptionContext),
      Effect.bind("signalContext", () => SignalContext),
      Effect.bind(
        "result",
        ({ transactionContext, dbSubscriptionContext, signalContext }) =>
          Effect.tryPromise(() =>
            transactionFn(
              (tx) =>
                Effect.runPromise(
                  pipe(
                    fn(tx),
                    Effect.provideService(
                      TransactionContext,
                      transactionContext,
                    ),
                    Effect.provideService(
                      DBSubscriptionContext,
                      dbSubscriptionContext,
                    ),
                    Effect.provideService(SignalContext, signalContext),
                  ),
                ),
              config,
            ),
          ),
      ),
      Effect.map(({ result }) => result),
    );
