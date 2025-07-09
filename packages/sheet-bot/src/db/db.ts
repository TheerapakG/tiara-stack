import { drizzle } from "drizzle-orm/postgres-js";
import { Console, Effect, pipe } from "effect";
import postgres from "postgres";
import { Config } from "../config";

export class DB extends Effect.Service<DB>()("DB", {
  scoped: pipe(
    Effect.Do,
    Effect.tap(() => Console.log("creating db client")),
    Effect.bind("client", () =>
      Config.use(({ postgresUrl }) => Effect.try(() => postgres(postgresUrl))),
    ),
    Effect.bind("db", ({ client }) => Effect.try(() => drizzle(client))),
    Effect.tap(({ client }) =>
      Effect.addFinalizer(() =>
        pipe(
          Effect.promise(() => client.end()),
          Effect.andThen(() => Console.log("DB client closed")),
        ),
      ),
    ),
    Effect.map(({ db }) => db),
  ),
  dependencies: [Config.Default],
}) {}
